import * as fs from 'fs/promises';
import * as path from 'path';
import {
  Todo,
  createTodo,
  updateTodo,
  CreateTodoInput,
  UpdateTodoInput,
  FieldSelectionMode
} from '../types/Todo';
import { GitManager } from '../git/GitManager';
import { DirectoryManager } from './DirectoryManager';
import { SymlinkManager } from './SymlinkManager';

export interface ListOptions {
  // Filtering options
  status?: Todo['status'];
  priority?: Todo['priority'];
  project?: string;
  assignee?: string;
  tags?: string[];
  includeCompleted?: boolean;
  includeArchived?: boolean;

  // Sorting options
  sortBy?: 'priority' | 'createdAt' | 'modifiedAt' | 'dueDate';
  sortOrder?: 'asc' | 'desc';

  // Pagination options
  limit?: number;
  offset?: number;

  // Field selection options
  mode?: FieldSelectionMode;
  fields?: string[];
  excludeFields?: string[];
  includeNullDates?: boolean;
}

export interface TodoWithArchive extends Todo {
  archived?: boolean;
  archivedAt?: string;
}

/**
 * Repository for managing Todo CRUD operations
 */
export class TodoRepository {
  private repoPath: string;
  private todosFilePath: string;
  private gitManager: GitManager;
  private directoryManager: DirectoryManager;
  private symlinkManager: SymlinkManager;
  private todos: TodoWithArchive[] = [];
  private initialized = false;

  constructor(repoPath: string, gitManager: GitManager) {
    this.repoPath = repoPath;
    this.todosFilePath = path.join(repoPath, 'todos.json');
    this.gitManager = gitManager;
    this.directoryManager = new DirectoryManager(repoPath, gitManager);
    this.symlinkManager = new SymlinkManager(repoPath);
  }

  /**
   * Initialize the repository
   *
   * Automatically detects legacy format (todos.json) and migrates to directory-based structure.
   * For new installations, creates the directory structure directly.
   */
  async initialize(): Promise<void> {
    // Check if we need to migrate from legacy format
    const isLegacy = await this.isLegacyFormat();

    if (isLegacy) {
      // Automatically migrate from todos.json to directory structure
      await this.migrateLegacyToDirectory();
    }

    // Ensure directory structure exists
    await this.directoryManager.ensureDirectoryStructure();

    // Load todos from directory structure
    await this.loadTodos();

    this.initialized = true;
  }

  /**
   * Load todos from directory structure
   */
  private async loadTodos(): Promise<void> {
    try {
      const taskIds = await this.directoryManager.listAllTasks();

      // Load each todo from its directory
      this.todos = [];
      for (const taskId of taskIds) {
        try {
          const todo = await this.directoryManager.readTask(taskId);
          this.todos.push(todo as TodoWithArchive);
        } catch (error) {
          // Skip corrupted/unreadable tasks
          console.warn(`Failed to load task ${taskId}:`, error);
        }
      }
    } catch (error) {
      // If directory doesn't exist yet or is empty, start with empty array
      this.todos = [];
    }
  }


  /**
   * Ensure repository is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Repository not initialized. Call initialize() first.');
    }
  }

  /**
   * Create a new todo
   */
  async create(input: CreateTodoInput): Promise<Todo> {
    this.ensureInitialized();

    const todo = createTodo(input);

    // Write to directory structure
    await this.directoryManager.writeTask(todo);

    // Update symlinks
    await this.symlinkManager.updateSymlinks(todo);

    // Update in-memory cache
    this.todos.push(todo);

    // Reload cache from disk to ensure consistency across processes
    await this.loadTodos();

    return todo;
  }

  /**
   * Create multiple todos in a batch operation
   * @param inputs Array of todo inputs to create
   * @returns Array of created todos
   */
  async createBatch(inputs: CreateTodoInput[]): Promise<Todo[]> {
    this.ensureInitialized();

    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new Error('Inputs must be a non-empty array');
    }

    const createdTodos: Todo[] = [];

    try {
      // Create all todos
      for (const input of inputs) {
        const todo = createTodo(input);
        createdTodos.push(todo);

        // Write each todo to directory structure
        await this.directoryManager.writeTask(todo);

        // Update symlinks for this todo
        await this.symlinkManager.updateSymlinks(todo);

        // Update in-memory cache
        this.todos.push(todo);
      }

      // Reload cache from disk to ensure consistency across processes
      await this.loadTodos();

      return createdTodos;
    } catch (error) {
      // Rollback on failure - remove any todos that were added
      for (const todo of createdTodos) {
        const index = this.todos.findIndex(t => t.id === todo.id);
        if (index !== -1) {
          this.todos.splice(index, 1);
        }
        // Note: Files and symlinks will be cleaned up by Git rollback
      }
      throw error;
    }
  }

  /**
   * Update an existing todo
   */
  async update(id: string, updates: UpdateTodoInput): Promise<Todo> {
    this.ensureInitialized();

    const index = this.todos.findIndex(t => t.id === id && !t.archived);
    if (index === -1) {
      throw new Error('Todo not found');
    }

    const oldTodo = this.todos[index];
    const updatedTodo = updateTodo(oldTodo, updates);

    // Write updated todo to directory structure
    await this.directoryManager.writeTask(updatedTodo);

    // Update symlinks (only touches changed properties)
    await this.symlinkManager.updateSymlinksWithOldTask(updatedTodo, oldTodo);

    // Update in-memory cache
    this.todos[index] = updatedTodo;

    // Reload cache from disk to ensure consistency across processes
    await this.loadTodos();

    return updatedTodo;
  }

  /**
   * Get a todo by ID
   */
  async get(id: string): Promise<Todo> {
    this.ensureInitialized();

    const todo = this.todos.find(t => t.id === id && !t.archived);
    if (!todo) {
      throw new Error('Todo not found');
    }

    return todo;
  }

  /**
   * List todos with filters
   */
  async list(options: ListOptions = {}): Promise<Todo[]> {
    this.ensureInitialized();

    let filtered = this.todos.filter(t => options.includeArchived || !t.archived);

    // Apply includeCompleted filter (default: include all when undefined/null)
    // But don't apply this if user explicitly requested status: 'done' (let status filter take precedence)
    if (options.includeCompleted === false && options.status !== 'done') {
      filtered = filtered.filter(t => t.status !== 'done');
    }

    // Apply filters
    if (options.status) {
      filtered = filtered.filter(t => t.status === options.status);
    }

    if (options.priority) {
      filtered = filtered.filter(t => t.priority === options.priority);
    }

    if (options.project) {
      filtered = filtered.filter(t => t.project === options.project);
    }

    if (options.assignee) {
      filtered = filtered.filter(t => t.assignee === options.assignee);
    }

    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(t =>
        options.tags!.some(tag => t.tags.includes(tag))
      );
    }

    // Sort
    if (options.sortBy) {
      filtered.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (options.sortBy) {
          case 'priority':
            // Map priority to numeric values where higher number = higher priority
            // This way: asc = least important first, desc = most important first
            const priorityOrder = { low: 0, medium: 1, high: 2, urgent: 3 };
            aVal = priorityOrder[a.priority];
            bVal = priorityOrder[b.priority];
            break;
          case 'createdAt':
          case 'modifiedAt':
          case 'dueDate':
            aVal = a[options.sortBy] ? new Date(a[options.sortBy]!).getTime() : Infinity;
            bVal = b[options.sortBy] ? new Date(b[options.sortBy]!).getTime() : Infinity;
            break;
          default:
            return 0;
        }

        const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return options.sortOrder === 'desc' ? -result : result;
      });
    }

    // Paginate
    if (options.offset !== undefined || options.limit !== undefined) {
      const start = options.offset || 0;
      const end = options.limit ? start + options.limit : undefined;
      filtered = filtered.slice(start, end);
    }

    // Apply field projection
    const projected = filtered.map(todo => this.projectFields(todo, options));

    return projected as Todo[];
  }

  /**
   * Project (select) fields from a todo based on options
   * @private
   */
  private projectFields(todo: Todo, options: ListOptions): Partial<Todo> {
    // If no field selection options, return full todo (backward compatibility)
    if (!options.mode && !options.fields && !options.excludeFields) {
      return todo;
    }

    // Handle explicit fields selection
    if (options.fields && options.fields.length > 0) {
      const result: any = {};
      for (const field of options.fields) {
        if (field in todo) {
          result[field] = (todo as any)[field];
        }
      }
      return result;
    }

    // Handle excludeFields
    if (options.excludeFields && options.excludeFields.length > 0) {
      const result: any = { ...todo };
      for (const field of options.excludeFields) {
        delete result[field];
      }
      // Apply null date filtering if requested
      if (!options.includeNullDates) {
        if (result.dueDate === null || result.dueDate === undefined) {
          delete result.dueDate;
        }
        if (result.completedAt === null || result.completedAt === undefined) {
          delete result.completedAt;
        }
      }
      return result;
    }

    // Handle mode-based field selection
    // Default to 'standard' for better performance (reduced token usage for LLM clients)
    const mode = options.mode || 'standard';

    switch (mode) {
      case 'minimal':
        return {
          id: todo.id,
          text: todo.text,
          status: todo.status,
          priority: todo.priority,
          project: todo.project
        };

      case 'standard': {
        const standard: any = {
          id: todo.id,
          text: todo.text,
          status: todo.status,
          priority: todo.priority,
          project: todo.project,
          tags: todo.tags,
          assignee: todo.assignee,
          createdAt: todo.createdAt,
          modifiedAt: todo.modifiedAt
        };

        // Include dueDate only if set (unless includeNullDates is true)
        if (todo.dueDate || options.includeNullDates) {
          standard.dueDate = todo.dueDate;
        }

        // Include completedAt only if set (unless includeNullDates is true)
        if (todo.completedAt || options.includeNullDates) {
          standard.completedAt = todo.completedAt;
        }

        return standard;
      }

      case 'full':
      default:
        // Full mode always returns ALL fields including null dates
        return todo;
    }
  }

  /**
   * Delete (archive) a todo
   */
  async delete(id: string, hardDelete: boolean = false): Promise<void> {
    this.ensureInitialized();

    const index = this.todos.findIndex(t => t.id === id && !t.archived);
    if (index === -1) {
      throw new Error('Todo not found');
    }

    const todo = this.todos[index];

    if (hardDelete) {
      // Hard delete - remove from file system (remove artifacts too)
      await this.directoryManager.deleteTask(id, { preserveArtifacts: false });

      // Remove all symlinks
      await this.symlinkManager.removeSymlinks(todo);

      // Remove from in-memory cache
      this.todos.splice(index, 1);
    } else {
      // Soft delete - mark as archived but keep files
      const archivedTodo = {
        ...todo,
        archived: true,
        archivedAt: new Date().toISOString()
      };

      // Update the task file with archived flag
      await this.directoryManager.writeTask(archivedTodo);

      // Remove symlinks (archived todos don't appear in views)
      await this.symlinkManager.removeSymlinks(todo);

      // Update in-memory cache
      this.todos[index] = archivedTodo;
    }

    // Reload cache from disk to ensure consistency across processes
    await this.loadTodos();
  }

  /**
   * Search todos by text
   */
  async search(query: string): Promise<Todo[]> {
    this.ensureInitialized();

    const lowerQuery = query.toLowerCase();

    return this.todos.filter(t => {
      if (t.archived) return false;

      return (
        t.text.toLowerCase().includes(lowerQuery) ||
        (t.description && t.description.toLowerCase().includes(lowerQuery)) ||
        t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    });
  }

  /**
   * Complete a todo
   */
  async complete(id: string): Promise<Todo> {
    return this.update(id, {
      status: 'done',
      completedAt: new Date().toISOString()
    });
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<Todo['status'], number>;
    byPriority: Record<Todo['priority'], number>;
    byProject: Record<string, number>;
    completed: number;
    completionRate: number;
  }> {
    this.ensureInitialized();

    const activeTodos = this.todos.filter(t => !t.archived);

    const stats = {
      total: activeTodos.length,
      byStatus: {
        'todo': 0,
        'in-progress': 0,
        'blocked': 0,
        'done': 0
      },
      byPriority: {
        'low': 0,
        'medium': 0,
        'high': 0,
        'urgent': 0
      },
      byProject: {} as Record<string, number>,
      completed: 0,
      completionRate: 0
    };

    for (const todo of activeTodos) {
      stats.byStatus[todo.status]++;
      stats.byPriority[todo.priority]++;

      if (!stats.byProject[todo.project]) {
        stats.byProject[todo.project] = 0;
      }
      stats.byProject[todo.project]++;

      if (todo.status === 'done') {
        stats.completed++;
      }
    }

    stats.completionRate = stats.total > 0
      ? (stats.completed / stats.total) * 100
      : 0;

    return stats;
  }

  /**
   * Reload todos from file (useful after sync)
   */
  async reload(): Promise<void> {
    await this.loadTodos();
  }

  /**
   * Get todos by project
   */
  async getByProject(project: string): Promise<Todo[]> {
    return this.list({ project });
  }

  /**
   * Get todos by assignee
   */
  async getByAssignee(assignee: string): Promise<Todo[]> {
    return this.list({ assignee });
  }

  /**
   * Get overdue todos
   */
  async getOverdue(): Promise<Todo[]> {
    this.ensureInitialized();

    const now = new Date();
    return this.todos.filter(t =>
      !t.archived &&
      t.dueDate &&
      new Date(t.dueDate) < now &&
      t.status !== 'done'
    );
  }

  /**
   * Get todos due today
   */
  async getDueToday(): Promise<Todo[]> {
    this.ensureInitialized();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.todos.filter(t =>
      !t.archived &&
      t.dueDate &&
      new Date(t.dueDate) >= today &&
      new Date(t.dueDate) < tomorrow
    );
  }

  /**
   * Get todos due this week
   */
  async getDueThisWeek(): Promise<Todo[]> {
    this.ensureInitialized();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    return this.todos.filter(t =>
      !t.archived &&
      t.dueDate &&
      new Date(t.dueDate) >= today &&
      new Date(t.dueDate) < nextWeek
    );
  }

  /**
   * Get distinct projects
   */
  async getProjects(): Promise<string[]> {
    this.ensureInitialized();
    const activeTodos = this.todos.filter(t => !t.archived);
    return [...new Set(activeTodos.map(t => t.project))].sort();
  }

  /**
   * Get distinct tags
   */
  async getTags(): Promise<string[]> {
    this.ensureInitialized();
    const activeTodos = this.todos.filter(t => !t.archived);
    const allTags = activeTodos.flatMap(t => t.tags);
    return [...new Set(allTags)].sort();
  }

  /**
   * Get distinct assignees
   */
  async getAssignees(): Promise<string[]> {
    this.ensureInitialized();
    const activeTodos = this.todos.filter(t => !t.archived);
    return [...new Set(
      activeTodos
        .map(t => t.assignee)
        .filter((a): a is string => a !== undefined)
    )].sort();
  }

  /**
   * Get all priorities (from enum)
   */
  async getPriorities(): Promise<Todo['priority'][]> {
    return ['urgent', 'high', 'medium', 'low'];
  }

  /**
   * Get filter options (distinct values for projects, tags, assignees, priorities)
   * This is a combined method that calls all atomic methods
   */
  async getFilterOptions(): Promise<{
    projects: string[];
    tags: string[];
    assignees: string[];
    priorities: Todo['priority'][];
  }> {
    return {
      projects: await this.getProjects(),
      tags: await this.getTags(),
      assignees: await this.getAssignees(),
      priorities: await this.getPriorities()
    };
  }

  /**
   * Check if repository is using legacy format (todos.json)
   * Returns true if todos.json exists and todos/ directory doesn't exist
   */
  async isLegacyFormat(): Promise<boolean> {
    try {
      // Check if todos.json exists
      await fs.access(this.todosFilePath);

      // If todos/ directory also exists, we've already migrated
      try {
        await fs.access(path.join(this.repoPath, 'todos'));
        return false; // Already migrated
      } catch {
        return true; // Legacy format
      }
    } catch {
      return false; // No todos.json (new installation)
    }
  }

  /**
   * Migrate from legacy todos.json to directory-based persistence
   *
   * This method performs an automatic migration from the single-file format
   * to the new directory-based structure with symlink views.
   *
   * Migration steps:
   * 1. Create backup of todos.json (todos.json.backup)
   * 2. Load all todos from legacy file
   * 3. Create new directory structure (todos/tasks/, todos/by-*)
   * 4. Write each todo to individual directory (todos/tasks/{id}/)
   * 5. Create all symlinks for organizational views
   * 6. Remove original todos.json file
   * 7. Commit migration to Git
   *
   * Safety features:
   * - Creates backup before any modifications
   * - Atomic Git commit of all changes
   * - Throws error on failure (caller should handle rollback)
   *
   * @throws {Error} If migration fails at any step
   */
  async migrateLegacyToDirectory(): Promise<void> {
    try {
      // Step 1: Create backup
      const backupPath = `${this.todosFilePath}.backup`;
      await fs.copyFile(this.todosFilePath, backupPath);

      // Step 2: Load todos from legacy file
      const content = await fs.readFile(this.todosFilePath, 'utf-8');
      const data = JSON.parse(content);
      const todos: Todo[] = data.todos || [];

      // Step 3: Create directory structure
      await this.directoryManager.ensureDirectoryStructure();

      // Step 4: Write all todos to individual directories
      for (const todo of todos) {
        await this.directoryManager.writeTask(todo);
      }

      // Step 5: Create all symlinks
      await this.symlinkManager.rebuildAllSymlinks(todos);

      // Step 6: Remove todos.json
      await fs.unlink(this.todosFilePath);

      // Step 7: Commit migration
      await this.gitManager.commit(
        'chore: migrate from todos.json to directory-based persistence\n\n' +
        'Automatic migration from single-file format to directory structure with symlink views.\n\n' +
        `Migrated ${todos.length} todos to individual directories.`
      );

    } catch (error) {
      throw new Error(
        `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        `Check backup at ${this.todosFilePath}.backup`
      );
    }
  }
}
import * as fs from 'fs/promises';
import * as path from 'path';
import { GitManager } from '../git/GitManager';
import { Todo, TodoSchema } from '../types/Todo';

/**
 * Manages directory-based persistence for todos
 *
 * Provides an abstraction layer over the file system for storing tasks
 * in a directory-based structure. Each task gets its own directory with:
 * - task.json: Core task metadata
 * - README.md: Optional rich description (for long descriptions)
 * - artifacts/: Optional directory for attached files/images
 *
 * Directory structure:
 * ```
 * todos/
 *   tasks/
 *     {task-id}/
 *       task.json          - Task metadata
 *       README.md          - Optional rich description
 *       artifacts/         - Optional files/images
 *   by-project/           - Symlinks organized by project
 *   by-status/            - Symlinks organized by status
 *   by-priority/          - Symlinks organized by priority
 *   by-tag/               - Symlinks organized by tags
 *   by-assignee/          - Symlinks organized by assignee
 * ```
 *
 * @example
 * ```typescript
 * const dirManager = new DirectoryManager('/path/to/repo', gitManager);
 * await dirManager.ensureDirectoryStructure();
 *
 * // Write a task
 * await dirManager.writeTask(myTodo);
 *
 * // Read a task
 * const todo = await dirManager.readTask(taskId);
 *
 * // Delete a task
 * await dirManager.deleteTask(taskId);
 * ```
 */
export class DirectoryManager {
  private readonly todosBasePath: string;
  private readonly tasksPath: string;
  private readonly gitManager: GitManager;

  // Configuration constants
  private static readonly README_THRESHOLD = 300; // Extract descriptions > 300 chars to README.md
  private static readonly README_PLACEHOLDER = '[See README.md]';
  private static readonly TASK_FILENAME = 'task.json';
  private static readonly README_FILENAME = 'README.md';
  private static readonly ARTIFACTS_DIRNAME = 'artifacts';

  // View directory names
  private static readonly VIEW_DIRECTORIES = [
    'by-project',
    'by-status',
    'by-priority',
    'by-tag',
    'by-assignee'
  ] as const;

  constructor(repoPath: string, gitManager: GitManager) {
    this.todosBasePath = path.join(repoPath, 'todos');
    this.tasksPath = path.join(this.todosBasePath, 'tasks');
    this.gitManager = gitManager;
  }

  /**
   * Ensure the complete directory structure exists
   *
   * Creates the base directory structure for directory-based persistence:
   * - todos/tasks/ (primary storage)
   * - todos/by-project/ (view directory)
   * - todos/by-status/ (view directory)
   * - todos/by-priority/ (view directory)
   * - todos/by-tag/ (view directory)
   * - todos/by-assignee/ (view directory)
   *
   * This method is idempotent - safe to call multiple times.
   *
   * @throws {Error} If directory creation fails (e.g., permission denied)
   */
  async ensureDirectoryStructure(): Promise<void> {
    const directories = [
      this.tasksPath,
      ...DirectoryManager.VIEW_DIRECTORIES.map(dir =>
        path.join(this.todosBasePath, dir)
      )
    ];

    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error: any) {
        // Ignore EEXIST errors (directory already exists)
        if (error.code !== 'EEXIST') {
          throw error;
        }
      }
    }
  }

  /**
   * Get the directory path for a task
   */
  getTaskPath(taskId: string): string {
    if (!taskId || typeof taskId !== 'string' || taskId.trim() === '') {
      throw new Error('Task ID cannot be empty');
    }
    return path.join(this.tasksPath, taskId);
  }

  /**
   * Get the file path for task.json
   *
   * @param taskId - The UUID of the task
   * @returns Full path to task.json file
   */
  getTaskFilePath(taskId: string): string {
    return path.join(this.getTaskPath(taskId), DirectoryManager.TASK_FILENAME);
  }

  /**
   * Get the file path for README.md
   *
   * @param taskId - The UUID of the task
   * @returns Full path to README.md file
   */
  getTaskReadmePath(taskId: string): string {
    return path.join(this.getTaskPath(taskId), DirectoryManager.README_FILENAME);
  }

  /**
   * Get the directory path for artifacts
   *
   * @param taskId - The UUID of the task
   * @returns Full path to artifacts directory
   */
  getTaskArtifactsPath(taskId: string): string {
    return path.join(this.getTaskPath(taskId), DirectoryManager.ARTIFACTS_DIRNAME);
  }

  /**
   * Check if a task exists
   */
  async taskExists(taskId: string): Promise<boolean> {
    try {
      await fs.access(this.getTaskPath(taskId));
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Read a task from disk
   * Reads task.json and optionally merges README.md content
   */
  async readTask(taskId: string): Promise<Todo> {
    try {
      // Read task.json
      const taskFilePath = this.getTaskFilePath(taskId);
      const taskJson = await fs.readFile(taskFilePath, 'utf-8');
      const taskData = JSON.parse(taskJson);

      // Try to read README.md if it exists
      try {
        const readmePath = this.getTaskReadmePath(taskId);
        const readmeContent = await fs.readFile(readmePath, 'utf-8');

        // Merge README content into description
        if (readmeContent && readmeContent.trim()) {
          taskData.description = readmeContent;
        }
      } catch (error: any) {
        // README.md is optional, ignore ENOENT
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      // Validate with Zod schema
      const todo = TodoSchema.parse(taskData);
      return todo;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Task ${taskId} not found`);
      }
      throw error;
    }
  }

  /**
   * Write a task to disk
   * Creates directory structure and writes task.json atomically
   * Optionally extracts long descriptions to README.md
   */
  async writeTask(todo: Todo): Promise<void> {
    // Validate input
    const validatedTodo = TodoSchema.parse(todo);

    // Ensure task directory exists
    const taskDir = this.getTaskPath(validatedTodo.id);
    await fs.mkdir(taskDir, { recursive: true });

    // Prepare task data for JSON (without README content if extracted)
    let taskData = { ...validatedTodo };

    // Extract long descriptions to README.md
    if (validatedTodo.description && validatedTodo.description.length > DirectoryManager.README_THRESHOLD) {
      const readmePath = this.getTaskReadmePath(validatedTodo.id);
      await this.gitManager.writeFileAtomic(readmePath, validatedTodo.description);

      // Keep short reference in task.json
      taskData.description = DirectoryManager.README_PLACEHOLDER;
    }

    // Write task.json atomically
    const taskFilePath = this.getTaskFilePath(validatedTodo.id);
    const taskJson = JSON.stringify(taskData, null, 2);
    await this.gitManager.writeFileAtomic(taskFilePath, taskJson);
  }

  /**
   * Delete a task from disk
   * Removes entire task directory
   */
  async deleteTask(taskId: string, options?: { preserveArtifacts?: boolean }): Promise<void> {
    if (!taskId || typeof taskId !== 'string' || taskId.trim() === '') {
      throw new Error('Task ID cannot be empty');
    }

    const taskDir = this.getTaskPath(taskId);

    // Handle artifact preservation if requested
    if (options?.preserveArtifacts) {
      const artifactsPath = this.getTaskArtifactsPath(taskId);

      try {
        await fs.access(artifactsPath);

        // Artifacts exist, move them to backup location
        const backupPath = path.join(
          this.todosBasePath,
          `artifacts-backup-${taskId}-${Date.now()}`
        );
        await fs.mkdir(backupPath, { recursive: true });

        // Copy artifacts
        const files = await fs.readdir(artifactsPath);
        for (const file of files) {
          const srcPath = path.join(artifactsPath, file);
          const destPath = path.join(backupPath, file);
          await fs.copyFile(srcPath, destPath);
        }
      } catch (error: any) {
        // Artifacts don't exist, ignore
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    }

    // Remove task directory
    try {
      await fs.rm(taskDir, { recursive: true, force: true });
    } catch (error: any) {
      // Ignore ENOENT (already deleted)
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * List all task IDs
   * Scans the tasks directory and returns all valid task IDs
   */
  async listAllTasks(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.tasksPath);

      // Filter out hidden files and non-directories
      const taskIds: string[] = [];
      for (const entry of entries) {
        // Skip hidden files
        if (entry.startsWith('.')) {
          continue;
        }

        // Check if it's a directory
        const entryPath = path.join(this.tasksPath, entry);
        try {
          const stat = await fs.stat(entryPath);
          if (stat.isDirectory()) {
            taskIds.push(entry);
          }
        } catch {
          // Skip entries we can't stat
          continue;
        }
      }

      return taskIds;
    } catch (error: any) {
      throw error;
    }
  }
}

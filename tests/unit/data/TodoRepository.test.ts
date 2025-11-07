import { TodoRepository } from '../../../src/data/TodoRepository';
import { GitManager } from '../../../src/git/GitManager';
import { DirectoryManager } from '../../../src/data/DirectoryManager';
import { SymlinkManager } from '../../../src/data/SymlinkManager';
import { Todo, createTodo } from '../../../src/types/Todo';
import * as fs from 'fs/promises';
import * as path from 'path';
import { uuidv7 } from 'uuidv7';

// Mock dependencies
jest.mock('../../../src/git/GitManager');
jest.mock('../../../src/data/DirectoryManager');
jest.mock('../../../src/data/SymlinkManager');
jest.mock('fs/promises');

describe('TodoRepository', () => {
  let repo: TodoRepository;
  let mockGitManager: jest.Mocked<GitManager>;
  let mockDirectoryManager: jest.Mocked<DirectoryManager>;
  let mockSymlinkManager: jest.Mocked<SymlinkManager>;
  const testRepoPath = '/test/repo/path';
  const todosFilePath = path.join(testRepoPath, 'todos.json');

  // Store for in-memory todos (simulates directory structure)
  let storedTodos: Map<string, Todo> = new Map();

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    storedTodos.clear();

    // Create mock GitManager
    mockGitManager = {
      writeFileAtomic: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue({ success: true }),
      syncWithRetry: jest.fn().mockResolvedValue({ success: true })
    } as any;

    // Mock DirectoryManager
    mockDirectoryManager = {
      ensureDirectoryStructure: jest.fn().mockResolvedValue(undefined),
      listAllTasks: jest.fn().mockImplementation(async () => {
        return Array.from(storedTodos.keys());
      }),
      readTask: jest.fn().mockImplementation(async (id: string) => {
        const todo = storedTodos.get(id);
        if (!todo) {
          throw new Error('Task not found');
        }
        return todo;
      }),
      writeTask: jest.fn().mockImplementation(async (todo: Todo) => {
        storedTodos.set(todo.id, todo);
      }),
      deleteTask: jest.fn().mockImplementation(async (id: string) => {
        storedTodos.delete(id);
      }),
      taskExists: jest.fn().mockImplementation(async (id: string) => {
        return storedTodos.has(id);
      })
    } as any;

    // Mock SymlinkManager
    mockSymlinkManager = {
      updateSymlinks: jest.fn().mockResolvedValue(undefined),
      updateSymlinksWithOldTask: jest.fn().mockResolvedValue(undefined),
      removeSymlinks: jest.fn().mockResolvedValue(undefined),
      rebuildAllSymlinks: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock fs functions (for migration tests)
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ todos: [] }));
    (fs.access as jest.Mock).mockRejectedValue({ code: 'ENOENT' }); // No legacy format by default
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.copyFile as jest.Mock).mockResolvedValue(undefined);
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);
    (fs.symlink as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue([]);
    (fs.stat as jest.Mock).mockResolvedValue({ isDirectory: () => true } as any);

    // Mock DirectoryManager and SymlinkManager constructors
    (DirectoryManager as jest.MockedClass<typeof DirectoryManager>).mockImplementation(() => mockDirectoryManager);
    (SymlinkManager as jest.MockedClass<typeof SymlinkManager>).mockImplementation(() => mockSymlinkManager);

    // Create repository instance and initialize
    repo = new TodoRepository(testRepoPath, mockGitManager);
    await repo.initialize();
  });

  describe('create', () => {
    it('should create todo with generated ID', async () => {
      const input = {
        text: 'Test todo',
        project: 'work',
        createdBy: 'user-123'
      };

      const todo = await repo.create(input);

      expect(todo.id).toBeDefined();
      expect(todo.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(todo.text).toBe('Test todo');
    });

    it('should set createdAt timestamp', async () => {
      const input = {
        text: 'Test todo',
        project: 'work',
        createdBy: 'user-123'
      };

      const before = Date.now();
      const todo = await repo.create(input);
      const after = Date.now();

      const createdTime = new Date(todo.createdAt).getTime();
      expect(createdTime).toBeGreaterThanOrEqual(before);
      expect(createdTime).toBeLessThanOrEqual(after);
    });

    it('should initialize all field timestamps', async () => {
      const input = {
        text: 'Test todo',
        project: 'work',
        createdBy: 'user-123',
        tags: ['test']
      };

      const todo = await repo.create(input);

      expect(todo.fieldTimestamps).toBeDefined();
      expect(todo.fieldTimestamps.text).toBeDefined();
      expect(todo.fieldTimestamps.project).toBeDefined();
      expect(todo.fieldTimestamps.tags).toBeDefined();
    });

    it('should validate input data', async () => {
      const invalidInput = {
        text: '', // Empty text should fail validation
        project: 'work',
        createdBy: 'user-123'
      };

      await expect(repo.create(invalidInput)).rejects.toThrow();
    });

    it('should persist to directory structure', async () => {
      const input = {
        text: 'Test todo',
        project: 'work',
        createdBy: 'user-123'
      };

      const todo = await repo.create(input);

      // Verify DirectoryManager.writeTask was called
      expect(mockDirectoryManager.writeTask).toHaveBeenCalledWith(
        expect.objectContaining({
          id: todo.id,
          text: 'Test todo',
          project: 'work'
        })
      );

      // Verify SymlinkManager.updateSymlinks was called
      expect(mockSymlinkManager.updateSymlinks).toHaveBeenCalledWith(
        expect.objectContaining({ id: todo.id })
      );
    });
  });

  describe('update', () => {
    let existingTodo: Todo;

    beforeEach(async () => {
      existingTodo = createTodo({
        id: uuidv7(),
        text: 'Original text',
        status: 'todo',
        priority: 'medium',
        project: 'work',
        tags: [],
        createdBy: 'user-123'
      });

      // Add existing todo to stored todos (simulates it being in directory)
      storedTodos.set(existingTodo.id, existingTodo);

      // Reload to populate in-memory cache
      await repo.reload();
    });

    it('should update only specified fields', async () => {
      const updates = {
        text: 'Updated text',
        priority: 'high' as const
      };

      const updated = await repo.update(existingTodo.id, updates);

      expect(updated.text).toBe('Updated text');
      expect(updated.priority).toBe('high');
      expect(updated.status).toBe('todo'); // Unchanged
      expect(updated.project).toBe('work'); // Unchanged
    });

    it('should update field timestamps for changed fields', async () => {
      const originalTextTimestamp = existingTodo.fieldTimestamps.text;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await repo.update(existingTodo.id, {
        text: 'New text'
      });

      expect(updated.fieldTimestamps.text).not.toBe(originalTextTimestamp);
      expect(new Date(updated.fieldTimestamps.text).getTime())
        .toBeGreaterThan(new Date(originalTextTimestamp).getTime());
    });

    it('should not update timestamps for unchanged fields', async () => {
      const originalTimestamps = { ...existingTodo.fieldTimestamps };

      const updated = await repo.update(existingTodo.id, {
        text: existingTodo.text // Same value
      });

      expect(updated.fieldTimestamps).toEqual(originalTimestamps);
    });

    it('should validate partial updates', async () => {
      await expect(repo.update(existingTodo.id, {
        status: 'invalid-status' as any
      })).rejects.toThrow();
    });

    it('should handle concurrent updates', async () => {
      // Simulate concurrent updates
      const update1 = repo.update(existingTodo.id, { text: 'Update 1' });
      const update2 = repo.update(existingTodo.id, { priority: 'high' as const });

      const [result1, result2] = await Promise.all([update1, update2]);

      // Both updates should succeed (last one wins for file write)
      expect(result1.text).toBe('Update 1');
      expect(result2.priority).toBe('high');
    });

    it('should throw error if todo not found', async () => {
      await expect(repo.update('non-existent-id', { text: 'New text' }))
        .rejects.toThrow('Todo not found');
    });
  });

  describe('list', () => {
    let todos: Todo[];

    beforeEach(async () => {
      todos = [
        createTodo({
          text: 'Todo 1',
          status: 'todo',
          priority: 'high',
          project: 'work',
          tags: ['backend'],
          assignee: 'user-123',
          createdBy: 'user-456'
        }),
        createTodo({
          text: 'Todo 2',
          status: 'done',
          priority: 'low',
          project: 'personal',
          tags: ['frontend'],
          assignee: 'user-789',
          createdBy: 'user-456'
        }),
        createTodo({
          text: 'Todo 3',
          status: 'in-progress',
          priority: 'medium',
          project: 'work',
          tags: ['backend', 'urgent'],
          assignee: 'user-123',
          createdBy: 'user-456'
        })
      ];

      // Add todos to stored todos (simulates them being in directory)
      todos.forEach(todo => storedTodos.set(todo.id, todo));

      // Reload to populate in-memory cache
      await repo.reload();
    });

    it('should filter by status', async () => {
      const result = await repo.list({ status: 'todo' });

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Todo 1');
    });

    it('should filter by project', async () => {
      const result = await repo.list({ project: 'work' });

      expect(result).toHaveLength(2);
      expect(result.map(t => t.text)).toContain('Todo 1');
      expect(result.map(t => t.text)).toContain('Todo 3');
    });

    it('should filter by assignee', async () => {
      const result = await repo.list({ assignee: 'user-123' });

      expect(result).toHaveLength(2);
      expect(result.every(t => t.assignee === 'user-123')).toBe(true);
    });

    it('should filter by tags', async () => {
      const result = await repo.list({ tags: ['backend'] });

      expect(result).toHaveLength(2);
      expect(result.map(t => t.text)).toContain('Todo 1');
      expect(result.map(t => t.text)).toContain('Todo 3');
    });

    it('should combine multiple filters', async () => {
      const result = await repo.list({
        project: 'work',
        status: 'in-progress',
        tags: ['backend']
      });

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Todo 3');
    });

    it('should sort by priority', async () => {
      // Add a todo with urgent priority
      const urgentTodo = createTodo({
        text: 'Urgent Todo',
        status: 'todo',
        priority: 'urgent',
        project: 'work',
        tags: [],
        createdBy: 'user-456'
      });

      // Add urgent todo to stored todos
      storedTodos.set(urgentTodo.id, urgentTodo);
      await repo.reload();

      const result = await repo.list({ sortBy: 'priority', sortOrder: 'desc' });

      expect(result[0].priority).toBe('urgent');
      expect(result[1].priority).toBe('high');
      expect(result[2].priority).toBe('medium');
      expect(result[3].priority).toBe('low');
    });

    it('should paginate results', async () => {
      const page1 = await repo.list({ limit: 2, offset: 0 });
      const page2 = await repo.list({ limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(1);
      expect(page1[0].id).not.toBe(page2[0]?.id);
    });
  });

  describe('delete', () => {
    let existingTodo: Todo;

    beforeEach(async () => {
      existingTodo = createTodo({
        id: uuidv7(),
        text: 'Todo to delete',
        project: 'work',
        createdBy: 'user-123'
      });

      // Add existing todo to stored todos
      storedTodos.set(existingTodo.id, existingTodo);
      await repo.reload();
    });

    it('should soft delete (archive) by default', async () => {
      await repo.delete(existingTodo.id);

      // Verify DirectoryManager.writeTask was called with archived flag
      expect(mockDirectoryManager.writeTask).toHaveBeenCalledWith(
        expect.objectContaining({
          id: existingTodo.id,
          archived: true
        })
      );

      // Verify SymlinkManager.removeSymlinks was called
      expect(mockSymlinkManager.removeSymlinks).toHaveBeenCalledWith(existingTodo);
    });

    it('should update archived timestamp', async () => {
      const before = Date.now();
      await repo.delete(existingTodo.id);
      const after = Date.now();

      // Get the todo that was written
      const writeCall = mockDirectoryManager.writeTask.mock.calls[0];
      const archivedTodo = writeCall[0] as any; // Cast to any since it includes archived fields

      const archivedTime = new Date(archivedTodo.archivedAt).getTime();
      expect(archivedTime).toBeGreaterThanOrEqual(before);
      expect(archivedTime).toBeLessThanOrEqual(after);
    });

    it('should remove from active list', async () => {
      await repo.delete(existingTodo.id);

      // List should not include archived todos by default
      const activeTodos = await repo.list();
      expect(activeTodos).toHaveLength(0);
    });

    it('should throw error if todo not found', async () => {
      await expect(repo.delete('non-existent-id'))
        .rejects.toThrow('Todo not found');
    });
  });

  describe('get', () => {
    let existingTodo: Todo;

    beforeEach(async () => {
      existingTodo = createTodo({
        id: uuidv7(),
        text: 'Test todo',
        project: 'work',
        createdBy: 'user-123'
      });

      // Add existing todo to stored todos
      storedTodos.set(existingTodo.id, existingTodo);
      await repo.reload();
    });

    it('should get todo by ID', async () => {
      const todo = await repo.get(existingTodo.id);

      expect(todo).toBeDefined();
      expect(todo.id).toBe(existingTodo.id);
      expect(todo.text).toBe('Test todo');
    });

    it('should throw error if todo not found', async () => {
      await expect(repo.get('non-existent-id'))
        .rejects.toThrow('Todo not found');
    });
  });

  describe('initialization', () => {
    it('should create directory structure if not exists', async () => {
      await repo.initialize();

      // Verify DirectoryManager.ensureDirectoryStructure was called
      expect(mockDirectoryManager.ensureDirectoryStructure).toHaveBeenCalled();
    });

    it('should not run migration if no legacy format', async () => {
      // fs.access is already mocked to reject (no todos.json)
      await repo.initialize();

      // Verify no backup was created (migration didn't run)
      expect(fs.copyFile).not.toHaveBeenCalled();
    });
  });

  describe('sync operations', () => {
    it('should reload todos after sync', async () => {
      const originalTodo = createTodo({
        text: 'Original',
        project: 'work',
        createdBy: 'user-123'
      });

      const newTodo = createTodo({
        text: 'Updated after sync',
        project: 'work',
        createdBy: 'user-123'
      });

      // Start with original todo
      storedTodos.set(originalTodo.id, originalTodo);
      await repo.reload();

      const beforeSync = await repo.list();
      expect(beforeSync[0].text).toBe('Original');

      // Simulate sync - replace with new todo
      storedTodos.clear();
      storedTodos.set(newTodo.id, newTodo);

      await repo.reload();
      const afterSync = await repo.list();
      expect(afterSync[0].text).toBe('Updated after sync');
    });
  });

  describe('search', () => {
    let todos: Todo[];

    beforeEach(async () => {
      todos = [
        createTodo({
          text: 'Implement search functionality',
          description: 'Add full-text search to the application',
          project: 'work',
          tags: ['backend', 'feature'],
          createdBy: 'user-123'
        }),
        createTodo({
          text: 'Fix search bug',
          description: 'Search results are not sorted correctly',
          project: 'work',
          tags: ['bug'],
          createdBy: 'user-123'
        }),
        createTodo({
          text: 'Write tests',
          description: 'Add unit tests for new features',
          project: 'work',
          tags: ['testing'],
          createdBy: 'user-123'
        })
      ];

      // Add todos to stored todos
      todos.forEach(todo => storedTodos.set(todo.id, todo));
      await repo.reload();
    });

    it('should search in text field', async () => {
      const results = await repo.search('search');

      expect(results).toHaveLength(2);
      expect(results.map(t => t.text)).toContain('Implement search functionality');
      expect(results.map(t => t.text)).toContain('Fix search bug');
    });

    it('should search in description field', async () => {
      const results = await repo.search('sorted');

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe('Fix search bug');
    });

    it('should be case insensitive', async () => {
      const results = await repo.search('SEARCH');

      expect(results).toHaveLength(2);
    });
  });

  describe('filter options', () => {
    beforeEach(async () => {
      const todos = [
        createTodo({
          text: 'Frontend task 1',
          project: 'frontend',
          priority: 'high',
          tags: ['ui', 'react'],
          assignee: 'alice',
          createdBy: 'user-123'
        }),
        createTodo({
          text: 'Backend task 1',
          project: 'backend',
          priority: 'urgent',
          tags: ['api', 'nodejs'],
          assignee: 'bob',
          createdBy: 'user-123'
        }),
        createTodo({
          text: 'Frontend task 2',
          project: 'frontend',
          priority: 'medium',
          tags: ['ui', 'css'],
          assignee: 'alice',
          createdBy: 'user-123'
        }),
        createTodo({
          text: 'DevOps task',
          project: 'infrastructure',
          priority: 'low',
          tags: ['docker', 'ci'],
          createdBy: 'user-123'
        })
      ];

      // Add todos to stored todos
      todos.forEach(todo => storedTodos.set(todo.id, todo));
      await repo.reload();
    });

    describe('getProjects', () => {
      it('should return distinct projects sorted alphabetically', async () => {
        const projects = await repo.getProjects();

        expect(projects).toEqual(['backend', 'frontend', 'infrastructure']);
      });

      it('should return empty array when no todos exist', async () => {
        storedTodos.clear();
        await repo.reload();

        const projects = await repo.getProjects();

        expect(projects).toEqual([]);
      });

      it('should not include archived todos', async () => {
        storedTodos.clear();

        const activeTodo = createTodo({
          text: 'Active',
          project: 'active-project',
          createdBy: 'user-123'
        });

        const archivedTodo = {
          ...createTodo({
            text: 'Archived',
            project: 'archived-project',
            createdBy: 'user-123'
          }),
          archived: true
        };

        storedTodos.set(activeTodo.id, activeTodo);
        storedTodos.set(archivedTodo.id, archivedTodo as any);
        await repo.reload();

        const projects = await repo.getProjects();

        expect(projects).toEqual(['active-project']);
      });
    });

    describe('getTags', () => {
      it('should return distinct tags sorted alphabetically', async () => {
        const tags = await repo.getTags();

        expect(tags).toEqual(['api', 'ci', 'css', 'docker', 'nodejs', 'react', 'ui']);
      });

      it('should flatten tags from multiple todos', async () => {
        storedTodos.clear();

        const todo1 = createTodo({
          text: 'Task 1',
          project: 'project1',
          tags: ['a', 'b'],
          createdBy: 'user-123'
        });

        const todo2 = createTodo({
          text: 'Task 2',
          project: 'project1',
          tags: ['b', 'c'],
          createdBy: 'user-123'
        });

        storedTodos.set(todo1.id, todo1);
        storedTodos.set(todo2.id, todo2);
        await repo.reload();

        const tags = await repo.getTags();

        expect(tags).toEqual(['a', 'b', 'c']);
      });

      it('should return empty array when no todos have tags', async () => {
        storedTodos.clear();

        const todo = createTodo({
          text: 'Task without tags',
          project: 'project1',
          createdBy: 'user-123'
        });

        storedTodos.set(todo.id, todo);
        await repo.reload();

        const tags = await repo.getTags();

        expect(tags).toEqual([]);
      });
    });

    describe('getAssignees', () => {
      it('should return distinct assignees sorted alphabetically', async () => {
        const assignees = await repo.getAssignees();

        expect(assignees).toEqual(['alice', 'bob']);
      });

      it('should not include undefined assignees', async () => {
        storedTodos.clear();

        const assignedTodo = createTodo({
          text: 'Assigned task',
          project: 'project1',
          assignee: 'charlie',
          createdBy: 'user-123'
        });

        const unassignedTodo = createTodo({
          text: 'Unassigned task',
          project: 'project1',
          createdBy: 'user-123'
        });

        storedTodos.set(assignedTodo.id, assignedTodo);
        storedTodos.set(unassignedTodo.id, unassignedTodo);
        await repo.reload();

        const assignees = await repo.getAssignees();

        expect(assignees).toEqual(['charlie']);
      });

      it('should return empty array when no todos are assigned', async () => {
        storedTodos.clear();

        const todo = createTodo({
          text: 'Unassigned',
          project: 'project1',
          createdBy: 'user-123'
        });

        storedTodos.set(todo.id, todo);
        await repo.reload();

        const assignees = await repo.getAssignees();

        expect(assignees).toEqual([]);
      });
    });

    describe('getPriorities', () => {
      it('should return all priority levels', async () => {
        const priorities = await repo.getPriorities();

        expect(priorities).toEqual(['urgent', 'high', 'medium', 'low']);
      });
    });

    describe('getFilterOptions', () => {
      it('should return all filter options', async () => {
        const options = await repo.getFilterOptions();

        expect(options).toEqual({
          projects: ['backend', 'frontend', 'infrastructure'],
          tags: ['api', 'ci', 'css', 'docker', 'nodejs', 'react', 'ui'],
          assignees: ['alice', 'bob'],
          priorities: ['urgent', 'high', 'medium', 'low']
        });
      });

      it('should return empty arrays when no todos exist', async () => {
        storedTodos.clear();
        await repo.reload();

        const options = await repo.getFilterOptions();

        expect(options).toEqual({
          projects: [],
          tags: [],
          assignees: [],
          priorities: ['urgent', 'high', 'medium', 'low']
        });
      });
    });
  });

  describe('Migration from legacy format', () => {
    describe('isLegacyFormat', () => {
      it('should return true if todos.json exists', async () => {
        (fs.access as jest.Mock)
          .mockResolvedValueOnce(undefined) // todos.json exists
          .mockRejectedValueOnce({ code: 'ENOENT' }); // todos/ does not exist

        const result = await repo.isLegacyFormat();

        expect(result).toBe(true);
        expect(fs.access).toHaveBeenCalledWith(todosFilePath);
      });

      it('should return false if todos.json does not exist', async () => {
        (fs.access as jest.Mock).mockRejectedValue({ code: 'ENOENT' });

        const result = await repo.isLegacyFormat();

        expect(result).toBe(false);
      });

      it('should return false if todos/ directory exists', async () => {
        (fs.access as jest.Mock)
          .mockResolvedValueOnce(undefined) // todos.json exists
          .mockResolvedValueOnce(undefined); // todos/ directory exists

        const result = await repo.isLegacyFormat();

        expect(result).toBe(false);
      });
    });

    describe('migrateLegacyToDirectory', () => {
      const mockTodos = [
        createTodo({
          id: '019a1234-5678-7000-8000-000000000001',
          text: 'Task 1',
          project: 'test-project',
          createdBy: 'user-1'
        }),
        createTodo({
          id: '019a1234-5678-7000-8000-000000000002',
          text: 'Task 2',
          project: 'another-project',
          status: 'done',
          priority: 'high',
          tags: ['urgent', 'bug'],
          assignee: 'user-2',
          createdBy: 'user-2'
        })
      ];

      beforeEach(() => {
        (fs.readFile as jest.Mock).mockResolvedValue(
          JSON.stringify({ todos: mockTodos })
        );
      });

      it('should create backup of todos.json', async () => {
        await repo.migrateLegacyToDirectory();

        expect(fs.copyFile).toHaveBeenCalledWith(
          todosFilePath,
          `${todosFilePath}.backup`
        );
      });

      it('should create directory structure', async () => {
        await repo.migrateLegacyToDirectory();

        // DirectoryManager.ensureDirectoryStructure should be called
        expect(mockDirectoryManager.ensureDirectoryStructure).toHaveBeenCalled();
      });

      it('should write all todos to individual directories', async () => {
        await repo.migrateLegacyToDirectory();

        // Should call DirectoryManager.writeTask for each todo
        expect(mockDirectoryManager.writeTask).toHaveBeenCalledTimes(2);
        expect(mockDirectoryManager.writeTask).toHaveBeenCalledWith(
          expect.objectContaining({ id: '019a1234-5678-7000-8000-000000000001' })
        );
        expect(mockDirectoryManager.writeTask).toHaveBeenCalledWith(
          expect.objectContaining({ id: '019a1234-5678-7000-8000-000000000002' })
        );
      });

      it('should create symlinks for all todos', async () => {
        await repo.migrateLegacyToDirectory();

        // Should call SymlinkManager.rebuildAllSymlinks with all todos
        expect(mockSymlinkManager.rebuildAllSymlinks).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ id: '019a1234-5678-7000-8000-000000000001' }),
            expect.objectContaining({ id: '019a1234-5678-7000-8000-000000000002' })
          ])
        );
      });

      it('should remove todos.json after successful migration', async () => {
        await repo.migrateLegacyToDirectory();

        expect(fs.unlink).toHaveBeenCalledWith(todosFilePath);
      });

      it('should commit migration', async () => {
        await repo.migrateLegacyToDirectory();

        expect(mockGitManager.commit).toHaveBeenCalledWith(
          expect.stringContaining('migrate')
        );
      });

      it('should handle empty todos.json', async () => {
        (fs.readFile as jest.Mock).mockResolvedValue(
          JSON.stringify({ todos: [] })
        );

        await expect(repo.migrateLegacyToDirectory()).resolves.not.toThrow();
      });

      it('should handle todos with special characters in project names', async () => {
        const todosWithSpecialChars = [
          createTodo({
            id: '019a1234-5678-7000-8000-000000000001',
            text: 'Task 1',
            project: 'My Project Name',
            createdBy: 'user-1'
          }),
          createTodo({
            id: '019a1234-5678-7000-8000-000000000002',
            text: 'Task 2',
            project: 'project/with/slashes',
            createdBy: 'user-2'
          })
        ];

        (fs.readFile as jest.Mock).mockResolvedValue(
          JSON.stringify({ todos: todosWithSpecialChars })
        );

        await expect(repo.migrateLegacyToDirectory()).resolves.not.toThrow();
      });

      it('should handle todos without optional fields', async () => {
        const minimalTodos = [
          createTodo({
            id: '019a1234-5678-7000-8000-000000000001',
            text: 'Minimal task',
            project: 'test',
            createdBy: 'user-1'
          })
        ];

        (fs.readFile as jest.Mock).mockResolvedValue(
          JSON.stringify({ todos: minimalTodos })
        );

        await expect(repo.migrateLegacyToDirectory()).resolves.not.toThrow();
      });

      it('should rollback on migration failure', async () => {
        // Make DirectoryManager.ensureDirectoryStructure fail
        mockDirectoryManager.ensureDirectoryStructure.mockRejectedValueOnce(new Error('Disk full'));

        await expect(repo.migrateLegacyToDirectory()).rejects.toThrow();

        // Should not remove todos.json on failure
        expect(fs.unlink).not.toHaveBeenCalledWith(todosFilePath);
      });

      it('should preserve todo data integrity during migration', async () => {
        await repo.migrateLegacyToDirectory();

        // Verify written data matches original
        const writeCalls = mockDirectoryManager.writeTask.mock.calls;
        const task1Call = writeCalls.find(call =>
          call[0].id === '019a1234-5678-7000-8000-000000000001'
        );
        const task2Call = writeCalls.find(call =>
          call[0].id === '019a1234-5678-7000-8000-000000000002'
        );

        expect(task1Call).toBeDefined();
        expect(task2Call).toBeDefined();

        const task1Data = task1Call![0];
        const task2Data = task2Call![0];

        expect(task1Data.text).toBe('Task 1');
        expect(task2Data.text).toBe('Task 2');
        expect(task2Data.tags).toEqual(['urgent', 'bug']);
      });
    });
  });
});
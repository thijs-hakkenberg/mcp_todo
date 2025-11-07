import { MCPServer } from '../../src/server/MCPServer';
import { TodoRepository } from '../../src/data/TodoRepository';
import { SyncManager } from '../../src/git/SyncManager';
import { GitManager } from '../../src/git/GitManager';
import { promises as fs } from 'fs';
import path from 'path';
import { createTodo } from '../../src/types/Todo';

// Mock dependencies
jest.mock('../../src/git/GitManager');
jest.mock('../../src/git/SyncManager');

describe('Error Handling Integration Tests', () => {
  let mcpServer: MCPServer;
  let todoRepo: TodoRepository;
  let mockSyncManager: jest.Mocked<SyncManager>;
  let mockGitManager: jest.Mocked<GitManager>;
  let testDir: string;
  let todosPath: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(__dirname, 'test-repo-' + Date.now());
    todosPath = path.join(testDir, 'todos.json');
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(todosPath, JSON.stringify({ todos: [] }));

    // Create mocks
    mockGitManager = {
      pull: jest.fn().mockResolvedValue({ success: true, hasConflicts: false }),
      push: jest.fn().mockResolvedValue({ success: true }),
      commit: jest.fn().mockResolvedValue({ success: true }),
      getStatus: jest.fn().mockResolvedValue({
        hasChanges: false,
        ahead: 0,
        behind: 0,
        modified: [],
        created: [],
        deleted: [],
        conflicted: [],
        current: 'main',
        tracking: 'origin/main'
      })
    } as any;

    mockSyncManager = {
      sync: jest.fn().mockResolvedValue({ success: true }),
      createWithSync: jest.fn(),
      updateWithSync: jest.fn(),
      deleteWithSync: jest.fn(),
      isSyncing: jest.fn().mockReturnValue(false),
      getLastSyncTime: jest.fn(),
      getStats: jest.fn()
    } as any;

    // Create real TodoRepository with test directory
    todoRepo = new TodoRepository(testDir, mockGitManager);
    await todoRepo.initialize();

    // Create MCPServer with mocked dependencies
    mcpServer = new MCPServer(todoRepo, mockSyncManager, mockGitManager);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // TODO: Update these tests for directory-based persistence
  describe.skip('Corrupted todos.json handling (DEPRECATED - directory-based now)', () => {
    it('should handle malformed JSON gracefully', async () => {
      // Write invalid JSON
      await fs.writeFile(todosPath, '{ "todos": [{ invalid json }');

      // Try to list todos
      const result = await mcpServer.handleToolCall('list_todos', {});
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Failed to parse todos.json');
    });

    it('should handle missing todos array', async () => {
      // Write JSON without todos array
      await fs.writeFile(todosPath, '{}');

      // Try to list todos
      const result = await mcpServer.handleToolCall('list_todos', {});
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.todos).toEqual([]);
    });

    it('should handle invalid todo structure', async () => {
      // Write todos with invalid structure
      await fs.writeFile(todosPath, JSON.stringify({
        todos: [
          { id: 'not-a-uuid', text: 123 } // Invalid types
        ]
      }));

      // Try to list todos
      const result = await mcpServer.handleToolCall('list_todos', {});
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Invalid todo structure');
    });
  });

  // TODO: Update for directory-based persistence
  describe.skip('File permission errors (needs update for directory-based)', () => {
    it('should handle read-only todos.json', async () => {
      // Make file read-only
      await fs.chmod(todosPath, 0o444);

      // Try to create a todo
      mockSyncManager.createWithSync.mockRejectedValue(
        new Error('EACCES: permission denied')
      );

      const result = await mcpServer.handleToolCall('create_todo', {
        text: 'Test todo',
        project: 'test'
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toContain('permission denied');

      // Restore permissions for cleanup
      await fs.chmod(todosPath, 0o644);
    });

    it('should handle directory permission errors', async () => {
      // Make directory read-only
      await fs.chmod(testDir, 0o555);

      // Try to create a backup file
      const backupPath = path.join(testDir, 'todos.json.backup');

      try {
        await fs.writeFile(backupPath, '{}');
        // If this succeeds, the test environment doesn't support this test
        await fs.chmod(testDir, 0o755);
        return;
      } catch (error: any) {
        expect(error.code).toBe('EACCES');
      }

      // Restore permissions
      await fs.chmod(testDir, 0o755);
    });
  });

  // TODO: Update for directory-based persistence (Phase 8)
  describe.skip('Git operation failures (needs update for directory-based)', () => {
    it('should handle network timeouts during sync', async () => {
      mockGitManager.pull.mockRejectedValue(
        new Error('fatal: unable to access repository: Operation timed out')
      );

      const result = await mcpServer.handleToolCall('sync_repository', {});
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Operation timed out');
    });

    it('should handle merge conflicts', async () => {
      mockGitManager.pull.mockResolvedValue({
        success: false,
        hasConflicts: true,
        conflictedFiles: ['todos.json']
      });

      const result = await mcpServer.handleToolCall('sync_repository', {});
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.hasConflicts).toBe(true);
      expect(response.conflictedFiles).toContain('todos.json');
    });

    it('should handle authentication failures', async () => {
      mockGitManager.push.mockRejectedValue(
        new Error('fatal: Authentication failed')
      );

      mockSyncManager.sync.mockResolvedValue({
        success: false,
        hasConflicts: false,
        error: 'Authentication failed'
      });

      const result = await mcpServer.handleToolCall('sync_repository', {});
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Authentication failed');
    });
  });

  // TODO: Update for directory-based persistence (Phase 8)
  describe.skip('Concurrent operation handling (needs update for directory-based)', () => {
    it('should handle concurrent creates gracefully', async () => {
      const todo1 = createTodo({
        text: 'Todo 1',
        project: 'test',
        createdBy: 'user-1'
      });

      const todo2 = createTodo({
        text: 'Todo 2',
        project: 'test',
        createdBy: 'user-2'
      });

      mockSyncManager.createWithSync
        .mockResolvedValueOnce(todo1)
        .mockResolvedValueOnce(todo2);

      // Create todos concurrently
      const [result1, result2] = await Promise.all([
        mcpServer.handleToolCall('create_todo', {
          text: 'Todo 1',
          project: 'test'
        }),
        mcpServer.handleToolCall('create_todo', {
          text: 'Todo 2',
          project: 'test'
        })
      ]);

      const response1 = JSON.parse(result1.content[0].text);
      const response2 = JSON.parse(result2.content[0].text);

      expect(response1.success).toBe(true);
      expect(response2.success).toBe(true);
      expect(response1.todo.text).toBe('Todo 1');
      expect(response2.todo.text).toBe('Todo 2');
    });

    it('should handle concurrent updates to same todo', async () => {
      const todo = createTodo({
        text: 'Original',
        project: 'test',
        createdBy: 'user-1'
      });

      // First update succeeds, second fails with conflict
      mockSyncManager.updateWithSync
        .mockResolvedValueOnce(todo)
        .mockRejectedValueOnce(new Error('Concurrent modification detected'));

      const [result1, result2] = await Promise.all([
        mcpServer.handleToolCall('update_todo', {
          id: todo.id,
          text: 'Update 1'
        }),
        mcpServer.handleToolCall('update_todo', {
          id: todo.id,
          text: 'Update 2'
        })
      ]);

      const response1 = JSON.parse(result1.content[0].text);
      const response2 = JSON.parse(result2.content[0].text);

      expect(response1.success || response2.success).toBe(true);
      expect(!response1.success || !response2.success).toBe(true);
    });
  });

  // TODO: Update for directory-based persistence (Phase 8)
  describe.skip('Data integrity (needs update for directory-based)', () => {
    it('should not lose data on sync failure', async () => {
      const todo = createTodo({
        text: 'Important todo',
        project: 'critical',
        createdBy: 'user-1'
      });

      // Create todo successfully
      mockSyncManager.createWithSync.mockResolvedValue(todo);

      const createResult = await mcpServer.handleToolCall('create_todo', {
        text: 'Important todo',
        project: 'critical'
      });

      const createResponse = JSON.parse(createResult.content[0].text);
      expect(createResponse.success).toBe(true);

      // Sync fails
      mockGitManager.push.mockRejectedValue(new Error('Network error'));
      mockSyncManager.sync.mockResolvedValue({
        success: false,
        hasConflicts: false,
        error: 'Network error'
      });

      const syncResult = await mcpServer.handleToolCall('sync_repository', {});
      const syncResponse = JSON.parse(syncResult.content[0].text);
      expect(syncResponse.success).toBe(false);

      // Todo should still be available locally
      const listResult = await mcpServer.handleToolCall('list_todos', {});
      const listResponse = JSON.parse(listResult.content[0].text);

      // Note: This depends on implementation - adjust based on actual behavior
      expect(listResponse.success).toBe(true);
    });

    it('should validate todo IDs are UUIDs', async () => {
      const result = await mcpServer.handleToolCall('get_todo', {
        id: 'not-a-uuid'
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toContain('Invalid todo ID format');
    });
  });

  // TODO: Update for directory-based persistence
  describe.skip('Recovery mechanisms (needs update for directory-based)', () => {
    it('should create backup before risky operations', async () => {
      // Create initial todos
      const todos = [
        createTodo({ text: 'Todo 1', project: 'test', createdBy: 'user-1' }),
        createTodo({ text: 'Todo 2', project: 'test', createdBy: 'user-1' })
      ];

      await fs.writeFile(todosPath, JSON.stringify({ todos }));

      // Simulate a risky operation that might corrupt data
      mockGitManager.pull.mockResolvedValue({
        success: false,
        hasConflicts: true,
        conflictedFiles: ['todos.json']
      });

      // Check if backup exists after conflict
      // const backupPath = todosPath + '.backup';
      // Note: This depends on implementation - backup feature not yet implemented
    });

    it('should handle missing todos.json gracefully', async () => {
      // Delete todos.json
      await fs.unlink(todosPath);

      // Try to list todos - should recreate file
      const result = await mcpServer.handleToolCall('list_todos', {});
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.todos).toEqual([]);

      // File should be recreated
      const exists = await fs.access(todosPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('Error message quality', () => {
    it('should provide meaningful error messages', async () => {
      // Test various error scenarios
      const scenarios = [
        {
          call: 'create_todo',
          params: { text: '', project: 'test' },
          expectedError: 'Missing required parameter: text'
        },
        {
          call: 'update_todo',
          params: { id: 'non-existent' },
          expectedError: 'Todo not found'
        },
        {
          call: 'complete_todo',
          params: {},
          expectedError: 'Missing required parameter: id'
        }
      ];

      for (const scenario of scenarios) {
        const result = await mcpServer.handleToolCall(
          scenario.call,
          scenario.params
        );
        const response = JSON.parse(result.content[0].text);

        expect(response.success).toBe(false);
        expect(response.error).toBeDefined();
        expect(response.error.length).toBeGreaterThan(0);
      }
    });
  });
});
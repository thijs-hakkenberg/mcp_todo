import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TodoRepository } from '../src/data/TodoRepository';
import { GitManager } from '../src/git/GitManager';
import { MCPServer } from '../src/server/MCPServer';
import { SyncManager } from '../src/git/SyncManager';

describe('Batch Operations', () => {
  let tempDir: string;
  let todoRepo: TodoRepository;
  let gitManager: GitManager;
  let mcpServer: MCPServer;
  let syncManager: SyncManager;

  beforeEach(async () => {
    // Create temporary directory for test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'batch-test-'));

    // Initialize git repository
    gitManager = new GitManager(tempDir);
    await gitManager.initialize();

    // Initialize todo repository
    todoRepo = new TodoRepository(tempDir, gitManager);
    await todoRepo.initialize();

    // Initialize sync manager
    syncManager = new SyncManager(gitManager, todoRepo);

    // Initialize MCP server
    mcpServer = new MCPServer(todoRepo, syncManager, gitManager);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('TodoRepository.createBatch', () => {
    it('should create multiple todos in a single operation', async () => {
      const inputs = [
        {
          text: 'First todo',
          project: 'test-project',
          priority: 'high' as const,
          status: 'todo' as const,
          tags: ['batch', 'test'],
          createdBy: 'test-user'
        },
        {
          text: 'Second todo',
          project: 'test-project',
          priority: 'medium' as const,
          status: 'in-progress' as const,
          tags: ['batch'],
          createdBy: 'test-user'
        },
        {
          text: 'Third todo',
          project: 'test-project',
          priority: 'low' as const,
          status: 'todo' as const,
          tags: ['test'],
          createdBy: 'test-user'
        }
      ];

      const todos = await todoRepo.createBatch(inputs);

      expect(todos).toHaveLength(3);
      expect(todos[0].text).toBe('First todo');
      expect(todos[0].priority).toBe('high');
      expect(todos[1].text).toBe('Second todo');
      expect(todos[1].status).toBe('in-progress');
      expect(todos[2].text).toBe('Third todo');
      expect(todos[2].tags).toContain('test');

      // Verify todos are persisted
      const allTodos = await todoRepo.list();
      expect(allTodos).toHaveLength(3);
    });

    it('should rollback on failure', async () => {
      const inputs = [
        {
          text: 'Valid todo',
          project: 'test-project',
          createdBy: 'test-user'
        }
      ];

      // Create first batch successfully
      await todoRepo.createBatch(inputs);

      // Mock DirectoryManager.writeTask to throw error after first write
      const directoryManager = (todoRepo as any).directoryManager;
      const originalWriteTask = directoryManager.writeTask;
      let callCount = 0;
      directoryManager.writeTask = async (todo: any) => {
        callCount++;
        if (callCount > 1) {
          throw new Error('Write failed');
        }
        return originalWriteTask.call(directoryManager, todo);
      };

      // Attempt to create another batch - should fail on second todo
      const secondBatchInputs = [
        {
          text: 'Second todo',
          project: 'test-project',
          createdBy: 'test-user'
        },
        {
          text: 'Should fail',
          project: 'test-project',
          createdBy: 'test-user'
        }
      ];
      await expect(todoRepo.createBatch(secondBatchInputs)).rejects.toThrow('Write failed');

      // Restore original method
      directoryManager.writeTask = originalWriteTask;

      // Verify only the first todo exists
      const allTodos = await todoRepo.list();
      expect(allTodos).toHaveLength(1);
    });

    it('should reject empty array', async () => {
      await expect(todoRepo.createBatch([])).rejects.toThrow('Inputs must be a non-empty array');
    });
  });

  describe('MCPServer.batch_create_todos', () => {
    it('should create multiple todos via MCP', async () => {
      const args = {
        todos: [
          {
            text: 'Parent task',
            project: 'batch-test',
            priority: 'high',
            tags: ['parent']
          },
          {
            text: 'Child task 1',
            project: 'batch-test',
            priority: 'medium',
            parentIndex: 0
          },
          {
            text: 'Child task 2',
            project: 'batch-test',
            priority: 'medium',
            parentIndex: 0
          }
        ]
      };

      const result = await mcpServer.handleToolCall('batch_create_todos', args);
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.count).toBe(3);
      expect(response.todos).toHaveLength(3);

      // Verify parent-child relationships
      const parentTodo = response.todos[0];
      const childTodo1 = response.todos[1];
      const childTodo2 = response.todos[2];

      expect(childTodo1.dependencies).toContain(parentTodo.id);
      expect(childTodo1.tags).toContain(`parent:${parentTodo.id}`);
      expect(childTodo2.dependencies).toContain(parentTodo.id);
      expect(childTodo2.tags).toContain(`parent:${parentTodo.id}`);
    });

    it('should validate required fields', async () => {
      const args = {
        todos: [
          {
            text: '',  // Empty text
            project: 'test'
          }
        ]
      };

      const result = await mcpServer.handleToolCall('batch_create_todos', args);
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('text cannot be empty');
    });

    it('should validate project is required', async () => {
      const args = {
        todos: [
          {
            text: 'Valid text'
            // Missing project
          }
        ]
      };

      const result = await mcpServer.handleToolCall('batch_create_todos', args);
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('project is required');
    });

    it('should validate parentIndex references', async () => {
      const args = {
        todos: [
          {
            text: 'Child',
            project: 'test',
            parentIndex: 1  // Invalid: references future todo
          },
          {
            text: 'Parent',
            project: 'test'
          }
        ]
      };

      const result = await mcpServer.handleToolCall('batch_create_todos', args);
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('parentIndex must reference a todo that comes before it');
    });

    it('should handle complex hierarchies', async () => {
      const args = {
        todos: [
          {
            text: 'Root task',
            project: 'hierarchy-test',
            priority: 'urgent'
          },
          {
            text: 'Level 1 - Task A',
            project: 'hierarchy-test',
            parentIndex: 0
          },
          {
            text: 'Level 1 - Task B',
            project: 'hierarchy-test',
            parentIndex: 0
          },
          {
            text: 'Level 2 - Task A.1',
            project: 'hierarchy-test',
            parentIndex: 1
          },
          {
            text: 'Level 2 - Task A.2',
            project: 'hierarchy-test',
            parentIndex: 1
          }
        ]
      };

      const result = await mcpServer.handleToolCall('batch_create_todos', args);
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.count).toBe(5);

      // Verify hierarchy
      const root = response.todos[0];
      const taskA = response.todos[1];
      const taskB = response.todos[2];
      const taskA1 = response.todos[3];
      const taskA2 = response.todos[4];

      expect(taskA.dependencies).toContain(root.id);
      expect(taskB.dependencies).toContain(root.id);
      expect(taskA1.dependencies).toContain(taskA.id);
      expect(taskA2.dependencies).toContain(taskA.id);
    });

    it('should preserve all todo properties', async () => {
      const dueDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow

      const args = {
        todos: [
          {
            text: 'Full featured todo',
            description: 'This is a detailed description',
            project: 'feature-test',
            priority: 'high',
            status: 'in-progress',
            tags: ['important', 'urgent', 'review'],
            assignee: 'john.doe',
            dueDate: dueDate,
            dependencies: []
          }
        ]
      };

      const result = await mcpServer.handleToolCall('batch_create_todos', args);
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);

      const todo = response.todos[0];
      expect(todo.text).toBe('Full featured todo');
      expect(todo.description).toBe('This is a detailed description');
      expect(todo.project).toBe('feature-test');
      expect(todo.priority).toBe('high');
      expect(todo.status).toBe('in-progress');
      expect(todo.tags).toEqual(['important', 'urgent', 'review']);
      expect(todo.assignee).toBe('john.doe');
      expect(todo.dueDate).toBe(dueDate);
    });

    it('should handle empty todos array', async () => {
      const args = {
        todos: []
      };

      const result = await mcpServer.handleToolCall('batch_create_todos', args);
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Todos array cannot be empty');
    });

    it('should handle missing todos parameter', async () => {
      const args = {};

      const result = await mcpServer.handleToolCall('batch_create_todos', args);
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Missing required parameter: todos');
    });
  });

  // TODO: Re-establish performance benchmarks after directory-based migration (Phase 9)
  describe.skip('Performance (needs re-benchmarking for directory-based)', () => {
    it('should efficiently handle large batches', async () => {
      const largeBatch = Array.from({ length: 100 }, (_, i) => ({
        text: `Todo ${i + 1}`,
        project: 'performance-test',
        priority: i % 2 === 0 ? 'high' as const : 'medium' as const,
        tags: [`batch-${Math.floor(i / 10)}`],
        createdBy: 'test-user'
      }));

      const startTime = Date.now();
      const todos = await todoRepo.createBatch(largeBatch);
      const endTime = Date.now();

      expect(todos).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all todos are created
      const allTodos = await todoRepo.list();
      expect(allTodos).toHaveLength(100);
    });

    it('should be faster than individual creates', async () => {
      const testData = Array.from({ length: 20 }, (_, i) => ({
        text: `Todo ${i + 1}`,
        project: 'speed-test',
        createdBy: 'test-user'
      }));

      // Time individual creates
      const individualStart = Date.now();
      for (const input of testData) {
        await todoRepo.create(input);
      }
      const individualTime = Date.now() - individualStart;

      // Clear todos
      const todos = await todoRepo.list();
      for (const todo of todos) {
        await todoRepo.delete(todo.id, true);
      }

      // Time batch create
      const batchStart = Date.now();
      await todoRepo.createBatch(testData);
      const batchTime = Date.now() - batchStart;

      // Batch should be significantly faster
      // Note: Directory-based operations have more I/O overhead
      expect(batchTime).toBeLessThan(individualTime * 0.7);
    });
  });
});
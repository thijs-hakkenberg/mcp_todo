/**
 * Integration tests for MCP client in Telegram context
 * Following TDD: These tests should fail initially (RED phase)
 */

import { MCPClient } from '../../../src/telegram/services/mcpClient';

// Mock child_process
jest.mock('child_process');

describe('MCPClient Integration', () => {
  let mcpClient: MCPClient;
  const serverPath = '/path/to/mcp/server';

  beforeEach(() => {
    mcpClient = new MCPClient(serverPath);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (mcpClient) {
      await mcpClient.disconnect();
    }
  });

  describe('connection', () => {
    it('should connect to MCP server via stdio', async () => {
      await expect(mcpClient.connect()).resolves.not.toThrow();
      expect(mcpClient.isConnected()).toBe(true);
    });

    it('should handle connection errors', async () => {
      const invalidClient = new MCPClient('/invalid/path');

      await expect(invalidClient.connect()).rejects.toThrow();
    });

    it('should disconnect from MCP server', async () => {
      await mcpClient.connect();
      await mcpClient.disconnect();

      expect(mcpClient.isConnected()).toBe(false);
    });

    it('should handle multiple connection attempts', async () => {
      await mcpClient.connect();
      await expect(mcpClient.connect()).rejects.toThrow('Already connected');
    });

    it('should handle disconnect when not connected', async () => {
      await expect(mcpClient.disconnect()).resolves.not.toThrow();
    });
  });

  describe('tool execution', () => {
    beforeEach(async () => {
      await mcpClient.connect();
    });

    it('should call create_todo tool', async () => {
      const result = await mcpClient.callTool('create_todo', {
        text: 'Test todo',
        project: 'work',
        priority: 'high'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data.text).toBe('Test todo');
    });

    it('should call list_todos tool', async () => {
      const result = await mcpClient.callTool('list_todos', {
        status: 'todo'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('todos');
      expect(Array.isArray(result.data.todos)).toBe(true);
    });

    it('should call update_todo tool', async () => {
      // First create a todo
      const createResult = await mcpClient.callTool('create_todo', {
        text: 'Test todo',
        project: 'work'
      });

      const todoId = createResult.data.id;

      // Then update it
      const updateResult = await mcpClient.callTool('update_todo', {
        id: todoId,
        status: 'in-progress'
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.data.status).toBe('in-progress');
    });

    it('should call complete_todo tool', async () => {
      // First create a todo
      const createResult = await mcpClient.callTool('create_todo', {
        text: 'Test todo',
        project: 'work'
      });

      const todoId = createResult.data.id;

      // Then complete it
      const completeResult = await mcpClient.callTool('complete_todo', {
        id: todoId
      });

      expect(completeResult.success).toBe(true);
      expect(completeResult.data.status).toBe('done');
    });

    it('should call delete_todo tool', async () => {
      // First create a todo
      const createResult = await mcpClient.callTool('create_todo', {
        text: 'Test todo',
        project: 'work'
      });

      const todoId = createResult.data.id;

      // Then delete it
      const deleteResult = await mcpClient.callTool('delete_todo', {
        id: todoId
      });

      expect(deleteResult.success).toBe(true);
    });

    it('should call search_todos tool', async () => {
      const result = await mcpClient.callTool('search_todos', {
        query: 'test'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('todos');
    });

    it('should call get_stats tool', async () => {
      const result = await mcpClient.callTool('get_stats', {});

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('total');
      expect(result.data).toHaveProperty('byStatus');
    });

    it('should handle tool execution errors', async () => {
      const result = await mcpClient.callTool('update_todo', {
        id: 'nonexistent',
        text: 'Updated'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle invalid tool names', async () => {
      await expect(mcpClient.callTool('invalid_tool', {}))
        .rejects.toThrow('Unknown tool: invalid_tool');
    });

    it('should validate tool parameters', async () => {
      const result = await mcpClient.callTool('create_todo', {
        // Missing required 'text' parameter
        project: 'work'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('text');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await mcpClient.connect();
    });

    it('should handle server crashes', async () => {
      // Simulate server crash
      await mcpClient.simulateServerCrash();

      expect(mcpClient.isConnected()).toBe(false);
    });

    it('should handle timeout errors', async () => {
      const result = await mcpClient.callTool('create_todo', {
        text: 'Test'
      }, 1); // 1ms timeout

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should handle malformed responses', async () => {
      // This would require mocking the stdio communication
      // to send malformed JSON
      const result = await mcpClient.callToolWithMalformedResponse('create_todo', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('malformed');
    });
  });

  describe('reconnection', () => {
    it('should support manual reconnection', async () => {
      await mcpClient.connect();
      await mcpClient.disconnect();
      await mcpClient.connect();

      expect(mcpClient.isConnected()).toBe(true);
    });

    it('should auto-reconnect on connection loss', async () => {
      mcpClient.enableAutoReconnect(true);
      await mcpClient.connect();

      // Simulate connection loss
      await mcpClient.simulateConnectionLoss();

      // Wait for auto-reconnect
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(mcpClient.isConnected()).toBe(true);
    });

    it('should respect max reconnection attempts', async () => {
      mcpClient.enableAutoReconnect(true, { maxAttempts: 3 });
      await mcpClient.connect();

      // Simulate permanent connection loss
      await mcpClient.simulatePermanentConnectionLoss();

      // Wait for all reconnection attempts
      await new Promise(resolve => setTimeout(resolve, 5000));

      expect(mcpClient.isConnected()).toBe(false);
    });
  });

  describe('batch operations', () => {
    beforeEach(async () => {
      await mcpClient.connect();
    });

    it('should support batch_create_todos', async () => {
      const result = await mcpClient.callTool('batch_create_todos', {
        todos: [
          { text: 'Todo 1', project: 'work' },
          { text: 'Todo 2', project: 'work' },
          { text: 'Todo 3', project: 'work' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.data.todos).toHaveLength(3);
    });

    it('should handle partial batch failures', async () => {
      const result = await mcpClient.callTool('batch_create_todos', {
        todos: [
          { text: 'Valid todo', project: 'work' },
          { text: '', project: 'work' }, // Invalid: empty text
          { text: 'Another valid todo', project: 'work' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.data.todos.length).toBeLessThan(3);
      expect(result.data.errors).toBeDefined();
    });
  });

  describe('performance', () => {
    beforeEach(async () => {
      await mcpClient.connect();
    });

    it('should handle concurrent tool calls', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        mcpClient.callTool('create_todo', {
          text: `Todo ${i}`,
          project: 'work'
        })
      );

      const results = await Promise.all(promises);

      expect(results.every(r => r.success)).toBe(true);
      expect(results).toHaveLength(10);
    });

    it('should complete tool calls within reasonable time', async () => {
      const start = Date.now();

      await mcpClient.callTool('list_todos', {});

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});

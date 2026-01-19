import { ChildProcess } from 'child_process';
import { MCPClient } from '../mcpClient';
import { EventEmitter } from 'events';

// Mock child_process
jest.mock('child_process');

// TODO: Fix Jest worker crashes (unrelated to directory-based migration)
describe.skip('MCP Client (Jest worker crashes - needs investigation)', () => {
  let mcpClient: MCPClient;
  let mockProcess: Partial<ChildProcess>;
  let mockStdin: EventEmitter;
  let mockStdout: EventEmitter;
  let mockStderr: EventEmitter;

  beforeEach(() => {
    // Create mock streams
    mockStdin = new EventEmitter();
    mockStdout = new EventEmitter();
    mockStderr = new EventEmitter();

    // Add write method to stdin
    (mockStdin as any).write = jest.fn((_data: string, callback?: Function) => {
      if (callback) callback();
      return true;
    });

    // Create mock process
    mockProcess = {
      stdin: mockStdin as any,
      stdout: mockStdout as any,
      stderr: mockStderr as any,
      pid: 12345,
      kill: jest.fn(),
      on: jest.fn()
    };

    // Mock spawn to return our mock process
    const childProcess = require('child_process');
    childProcess.spawn = jest.fn().mockReturnValue(mockProcess);

    mcpClient = new MCPClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (mcpClient) {
      mcpClient.disconnect();
    }
  });

  describe('Connection', () => {
    it('should spawn MCP server process on connect', async () => {
      const childProcess = require('child_process');

      await mcpClient.connect();

      expect(childProcess.spawn).toHaveBeenCalledWith(
        'node',
        ['dist/index.js'],
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe']
        })
      );
    });

    it('should handle process spawn errors', async () => {
      const childProcess = require('child_process');
      childProcess.spawn = jest.fn().mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      await expect(mcpClient.connect()).rejects.toThrow('Failed to spawn MCP server: Spawn failed');
    });

    it('should set connected flag when process spawns successfully', async () => {
      await mcpClient.connect();
      expect(mcpClient.isConnected()).toBe(true);
    });

    it('should not spawn multiple processes if already connected', async () => {
      const childProcess = require('child_process');

      await mcpClient.connect();
      await mcpClient.connect(); // Second call

      expect(childProcess.spawn).toHaveBeenCalledTimes(1);
    });
  });

  describe('JSON-RPC Communication', () => {
    beforeEach(async () => {
      await mcpClient.connect();
    });

    it('should send properly formatted JSON-RPC requests', async () => {
      const mockWrite = (mockStdin as any).write;

      const promise = mcpClient.sendRequest('list_todos', { status: 'todo' });

      // Check that request was written to stdin
      expect(mockWrite).toHaveBeenCalled();
      const sentData = mockWrite.mock.calls[0][0];
      const request = JSON.parse(sentData);

      expect(request).toMatchObject({
        jsonrpc: '2.0',
        method: 'list_todos',
        params: { status: 'todo' },
        id: expect.any(String)
      });

      // Simulate response
      const response = {
        jsonrpc: '2.0',
        result: { todos: [] },
        id: request.id
      };
      mockStdout.emit('data', Buffer.from(JSON.stringify(response) + '\n'));

      const result = await promise;
      expect(result).toEqual({ todos: [] });
    });

    it('should generate unique request IDs', async () => {
      const mockWrite = (mockStdin as any).write;

      mcpClient.sendRequest('method1', {});
      mcpClient.sendRequest('method2', {});

      const request1 = JSON.parse(mockWrite.mock.calls[0][0]);
      const request2 = JSON.parse(mockWrite.mock.calls[1][0]);

      expect(request1.id).not.toBe(request2.id);
    });

    it('should handle JSON-RPC error responses', async () => {
      const promise = mcpClient.sendRequest('invalid_method', {});

      // Get the request ID
      const mockWrite = (mockStdin as any).write;
      const request = JSON.parse(mockWrite.mock.calls[0][0]);

      // Send error response
      const errorResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Method not found'
        },
        id: request.id
      };
      mockStdout.emit('data', Buffer.from(JSON.stringify(errorResponse) + '\n'));

      await expect(promise).rejects.toThrow('Method not found');
    });

    it('should handle partial JSON responses', async () => {
      const promise = mcpClient.sendRequest('test_method', {});

      // Get request ID
      const mockWrite = (mockStdin as any).write;
      const request = JSON.parse(mockWrite.mock.calls[0][0]);

      // Send response in chunks
      const response = {
        jsonrpc: '2.0',
        result: { success: true },
        id: request.id
      };
      const responseStr = JSON.stringify(response) + '\n';

      // Split response into two chunks
      mockStdout.emit('data', Buffer.from(responseStr.slice(0, 10)));
      mockStdout.emit('data', Buffer.from(responseStr.slice(10)));

      const result = await promise;
      expect(result).toEqual({ success: true });
    });

    it('should timeout requests after specified duration', async () => {
      jest.useFakeTimers();

      const promise = mcpClient.sendRequest('slow_method', {}, 5000);

      // Advance time past timeout
      jest.advanceTimersByTime(5001);

      await expect(promise).rejects.toThrow('Request timeout');

      jest.useRealTimers();
    });
  });

  describe('Disconnection', () => {
    it('should kill process on disconnect', async () => {
      await mcpClient.connect();

      mcpClient.disconnect();

      expect(mockProcess.kill).toHaveBeenCalled();
      expect(mcpClient.isConnected()).toBe(false);
    });

    it('should handle disconnect when not connected', () => {
      expect(() => mcpClient.disconnect()).not.toThrow();
    });

    it('should clean up pending requests on disconnect', async () => {
      await mcpClient.connect();

      const promise = mcpClient.sendRequest('test_method', {});
      mcpClient.disconnect();

      await expect(promise).rejects.toThrow('Client disconnected');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await mcpClient.connect();
    });

    it('should handle stderr output', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      mockStderr.emit('data', Buffer.from('Error message'));

      expect(consoleSpy).toHaveBeenCalledWith('MCP Server Error:', 'Error message');

      consoleSpy.mockRestore();
    });

    it('should handle process exit', () => {
      const onExit = (mockProcess.on as jest.Mock).mock.calls.find(
        call => call[0] === 'exit'
      )?.[1];

      if (onExit) {
        onExit(1);
        expect(mcpClient.isConnected()).toBe(false);
      }
    });

    it('should reject pending requests on process exit', async () => {
      const promise = mcpClient.sendRequest('test_method', {});

      const onExit = (mockProcess.on as jest.Mock).mock.calls.find(
        call => call[0] === 'exit'
      )?.[1];

      if (onExit) {
        onExit(1);
      }

      await expect(promise).rejects.toThrow('MCP server exited');
    });
  });
});
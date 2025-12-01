/**
 * Unit tests for command handler
 * Following TDD: These tests should fail initially (RED phase)
 */

import { CommandHandler } from '../../../src/telegram/handlers/commandHandler';
import { Message as TelegramMessage } from 'node-telegram-bot-api';
import { MCPClient } from '../../../src/telegram/services/mcpClient';

// Mock dependencies
jest.mock('../../../src/telegram/services/mcpClient');

describe('CommandHandler', () => {
  let commandHandler: CommandHandler;
  let mockMcpClient: jest.Mocked<MCPClient>;

  beforeEach(() => {
    mockMcpClient = {
      callTool: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined)
    } as any;

    commandHandler = new CommandHandler(mockMcpClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create CommandHandler with MCP client', () => {
      expect(commandHandler).toBeDefined();
      expect(commandHandler).toBeInstanceOf(CommandHandler);
    });

    it('should throw error if MCP client is undefined', () => {
      expect(() => new CommandHandler(undefined as any)).toThrow('MCP client is required');
    });
  });

  describe('handleStart', () => {
    it('should return welcome message', async () => {
      const message: TelegramMessage = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123, type: 'private' },
        from: { id: 123, is_bot: false, first_name: 'Test' }
      };

      const response = await commandHandler.handleStart(message);

      expect(response).toContain('Welcome');
      expect(response).toContain('todo');
    });
  });

  describe('handleHelp', () => {
    it('should return help message with available commands', async () => {
      const message: TelegramMessage = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123, type: 'private' },
        from: { id: 123, is_bot: false, first_name: 'Test' }
      };

      const response = await commandHandler.handleHelp(message);

      expect(response).toContain('/start');
      expect(response).toContain('/help');
      expect(response).toContain('/list');
      expect(response).toContain('/create');
    });
  });

  describe('handleList', () => {
    it('should list todos from MCP server', async () => {
      const mockTodos = [
        { id: '1', text: 'Todo 1', status: 'todo', project: 'work' },
        { id: '2', text: 'Todo 2', status: 'in-progress', project: 'personal' }
      ];

      mockMcpClient.callTool.mockResolvedValue({
        success: true,
        data: { todos: mockTodos }
      });

      const message: TelegramMessage = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123, type: 'private' },
        from: { id: 123, is_bot: false, first_name: 'Test' },
        text: '/list'
      };

      const response = await commandHandler.handleList(message);

      expect(mockMcpClient.callTool).toHaveBeenCalledWith('list_todos', expect.any(Object));
      expect(response).toContain('Todo 1');
      expect(response).toContain('Todo 2');
    });

    it('should handle empty todo list', async () => {
      mockMcpClient.callTool.mockResolvedValue({
        success: true,
        data: { todos: [] }
      });

      const message: TelegramMessage = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123, type: 'private' },
        from: { id: 123, is_bot: false, first_name: 'Test' },
        text: '/list'
      };

      const response = await commandHandler.handleList(message);

      expect(response).toContain('No todos found');
    });

    it('should handle MCP client errors', async () => {
      mockMcpClient.callTool.mockResolvedValue({
        success: false,
        error: 'Connection failed'
      });

      const message: TelegramMessage = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123, type: 'private' },
        from: { id: 123, is_bot: false, first_name: 'Test' },
        text: '/list'
      };

      const response = await commandHandler.handleList(message);

      expect(response).toContain('Error');
      expect(response).toContain('Connection failed');
    });

    it('should support filtering by status', async () => {
      mockMcpClient.callTool.mockResolvedValue({
        success: true,
        data: { todos: [] }
      });

      const message: TelegramMessage = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123, type: 'private' },
        from: { id: 123, is_bot: false, first_name: 'Test' },
        text: '/list status:todo'
      };

      await commandHandler.handleList(message);

      expect(mockMcpClient.callTool).toHaveBeenCalledWith('list_todos',
        expect.objectContaining({ status: 'todo' })
      );
    });
  });

  describe('handleCreate', () => {
    it('should create todo via MCP server', async () => {
      const newTodo = {
        id: '123',
        text: 'New todo',
        status: 'todo',
        project: 'work'
      };

      mockMcpClient.callTool.mockResolvedValue({
        success: true,
        data: newTodo
      });

      const message: TelegramMessage = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123, type: 'private' },
        from: { id: 123, is_bot: false, first_name: 'Test' },
        text: '/create New todo project:work'
      };

      const response = await commandHandler.handleCreate(message);

      expect(mockMcpClient.callTool).toHaveBeenCalledWith('create_todo',
        expect.objectContaining({
          text: 'New todo',
          project: 'work'
        })
      );
      expect(response).toContain('Created');
      expect(response).toContain('New todo');
    });

    it('should handle missing todo text', async () => {
      const message: TelegramMessage = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123, type: 'private' },
        from: { id: 123, is_bot: false, first_name: 'Test' },
        text: '/create'
      };

      const response = await commandHandler.handleCreate(message);

      expect(response).toContain('Usage');
      expect(mockMcpClient.callTool).not.toHaveBeenCalled();
    });

    it('should support optional parameters', async () => {
      mockMcpClient.callTool.mockResolvedValue({
        success: true,
        data: { id: '123' }
      });

      const message: TelegramMessage = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123, type: 'private' },
        from: { id: 123, is_bot: false, first_name: 'Test' },
        text: '/create New todo project:work priority:high tags:urgent,important'
      };

      await commandHandler.handleCreate(message);

      expect(mockMcpClient.callTool).toHaveBeenCalledWith('create_todo',
        expect.objectContaining({
          text: 'New todo',
          project: 'work',
          priority: 'high',
          tags: ['urgent', 'important']
        })
      );
    });
  });

  describe('handleUpdate', () => {
    it('should update todo via MCP server', async () => {
      mockMcpClient.callTool.mockResolvedValue({
        success: true,
        data: { id: '123', text: 'Updated todo' }
      });

      const message: TelegramMessage = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123, type: 'private' },
        from: { id: 123, is_bot: false, first_name: 'Test' },
        text: '/update 123 text:Updated todo'
      };

      const response = await commandHandler.handleUpdate(message);

      expect(mockMcpClient.callTool).toHaveBeenCalledWith('update_todo',
        expect.objectContaining({
          id: '123',
          text: 'Updated todo'
        })
      );
      expect(response).toContain('Updated');
    });

    it('should handle missing todo ID', async () => {
      const message: TelegramMessage = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123, type: 'private' },
        from: { id: 123, is_bot: false, first_name: 'Test' },
        text: '/update'
      };

      const response = await commandHandler.handleUpdate(message);

      expect(response).toContain('Usage');
      expect(mockMcpClient.callTool).not.toHaveBeenCalled();
    });
  });

  describe('handleComplete', () => {
    it('should mark todo as complete', async () => {
      mockMcpClient.callTool.mockResolvedValue({
        success: true,
        data: { id: '123', status: 'done' }
      });

      const message: TelegramMessage = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123, type: 'private' },
        from: { id: 123, is_bot: false, first_name: 'Test' },
        text: '/complete 123'
      };

      const response = await commandHandler.handleComplete(message);

      expect(mockMcpClient.callTool).toHaveBeenCalledWith('complete_todo',
        expect.objectContaining({ id: '123' })
      );
      expect(response).toContain('Completed');
    });
  });

  describe('handleDelete', () => {
    it('should delete todo via MCP server', async () => {
      mockMcpClient.callTool.mockResolvedValue({
        success: true
      });

      const message: TelegramMessage = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123, type: 'private' },
        from: { id: 123, is_bot: false, first_name: 'Test' },
        text: '/delete 123'
      };

      const response = await commandHandler.handleDelete(message);

      expect(mockMcpClient.callTool).toHaveBeenCalledWith('delete_todo',
        expect.objectContaining({ id: '123' })
      );
      expect(response).toContain('Deleted');
    });
  });

  describe('parseCommand', () => {
    it('should parse command with arguments', () => {
      const text = '/create New todo project:work priority:high';
      const result = commandHandler.parseCommand(text);

      expect(result.command).toBe('create');
      expect(result.args).toContain('New');
      expect(result.args).toContain('todo');
      expect(result.params).toEqual({
        project: 'work',
        priority: 'high'
      });
    });

    it('should handle command without arguments', () => {
      const text = '/list';
      const result = commandHandler.parseCommand(text);

      expect(result.command).toBe('list');
      expect(result.args).toEqual([]);
      expect(result.params).toEqual({});
    });

    it('should handle tags as array', () => {
      const text = '/create Todo tags:tag1,tag2,tag3';
      const result = commandHandler.parseCommand(text);

      expect(result.params.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });
  });
});

/**
 * Integration tests for Telegram bot
 * Following TDD: These tests should fail initially (RED phase)
 */

import { TelegramBot } from '../../../src/telegram/bot';
import { MCPClient } from '../../../src/telegram/services/mcpClient';
import { WhisperClient } from '../../../src/telegram/services/whisperClient';
import { OllamaClient } from '../../../src/telegram/services/ollamaClient';

// Mock dependencies
jest.mock('../../../src/telegram/services/mcpClient');
jest.mock('../../../src/telegram/services/whisperClient');
jest.mock('../../../src/telegram/services/ollamaClient');

describe('TelegramBot Integration', () => {
  let bot: TelegramBot;
  let mockMcpClient: jest.Mocked<MCPClient>;
  let mockWhisperClient: jest.Mocked<WhisperClient>;
  let mockOllamaClient: jest.Mocked<OllamaClient>;

  const config = {
    token: 'test_token',
    authorizedUserId: '123456789',
    ollamaApiUrl: 'http://localhost:11434',
    whisperApiUrl: 'http://localhost:9000'
  };

  beforeEach(() => {
    mockMcpClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      callTool: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true)
    } as any;

    mockWhisperClient = {
      transcribe: jest.fn(),
      isAvailable: jest.fn().mockResolvedValue(true)
    } as any;

    mockOllamaClient = {
      generate: jest.fn(),
      isAvailable: jest.fn().mockResolvedValue(true)
    } as any;

    bot = new TelegramBot(config);
  });

  afterEach(async () => {
    if (bot) {
      await bot.stop();
    }
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create bot with configuration', () => {
      expect(bot).toBeDefined();
      expect(bot).toBeInstanceOf(TelegramBot);
    });

    it('should throw error if token is missing', () => {
      expect(() => new TelegramBot({ ...config, token: '' }))
        .toThrow('Bot token is required');
    });

    it('should throw error if authorized user ID is missing', () => {
      expect(() => new TelegramBot({ ...config, authorizedUserId: '' }))
        .toThrow('Authorized user ID is required');
    });

    it('should initialize all services', async () => {
      await bot.start();

      expect(mockMcpClient.connect).toHaveBeenCalled();
    });
  });

  describe('start/stop', () => {
    it('should start bot successfully', async () => {
      await expect(bot.start()).resolves.not.toThrow();
    });

    it('should stop bot successfully', async () => {
      await bot.start();
      await expect(bot.stop()).resolves.not.toThrow();
    });

    it('should handle multiple start calls', async () => {
      await bot.start();
      await expect(bot.start()).rejects.toThrow('Bot is already running');
    });

    it('should handle stop when not started', async () => {
      await expect(bot.stop()).resolves.not.toThrow();
    });

    it('should disconnect MCP client on stop', async () => {
      await bot.start();
      await bot.stop();

      expect(mockMcpClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('command handling', () => {
    beforeEach(async () => {
      await bot.start();
    });

    it('should handle /start command', async () => {
      const message = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123456789, type: 'private' },
        from: { id: 123456789, is_bot: false, first_name: 'Test' },
        text: '/start'
      };

      const response = await bot.handleMessage(message);

      expect(response).toContain('Welcome');
    });

    it('should handle /help command', async () => {
      const message = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123456789, type: 'private' },
        from: { id: 123456789, is_bot: false, first_name: 'Test' },
        text: '/help'
      };

      const response = await bot.handleMessage(message);

      expect(response).toContain('Available commands');
    });

    it('should reject unauthorized users', async () => {
      const message = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 987654321, type: 'private' },
        from: { id: 987654321, is_bot: false, first_name: 'Unauthorized' },
        text: '/start'
      };

      const response = await bot.handleMessage(message);

      expect(response).toContain('not authorized');
    });

    it('should handle unknown commands', async () => {
      const message = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123456789, type: 'private' },
        from: { id: 123456789, is_bot: false, first_name: 'Test' },
        text: '/unknown'
      };

      const response = await bot.handleMessage(message);

      expect(response).toContain('Unknown command');
    });
  });

  describe('voice message handling', () => {
    beforeEach(async () => {
      await bot.start();
    });

    it('should handle voice messages', async () => {
      mockWhisperClient.transcribe.mockResolvedValue({
        text: 'Create a todo for meeting',
        language: 'en'
      });

      mockOllamaClient.generate.mockResolvedValue({
        model: 'llama2',
        response: JSON.stringify({
          action: 'create_todo',
          params: { text: 'Meeting', project: 'work' }
        }),
        done: true
      });

      mockMcpClient.callTool.mockResolvedValue({
        success: true,
        data: { id: '123', text: 'Meeting' }
      });

      const message = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123456789, type: 'private' },
        from: { id: 123456789, is_bot: false, first_name: 'Test' },
        voice: {
          file_id: 'voice123',
          file_unique_id: 'unique123',
          duration: 5
        }
      };

      const response = await bot.handleMessage(message);

      expect(mockWhisperClient.transcribe).toHaveBeenCalled();
      expect(mockOllamaClient.generate).toHaveBeenCalled();
      expect(mockMcpClient.callTool).toHaveBeenCalledWith('create_todo', expect.any(Object));
      expect(response).toContain('Created');
    });

    it('should handle transcription errors', async () => {
      mockWhisperClient.transcribe.mockRejectedValue(new Error('Transcription failed'));

      const message = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123456789, type: 'private' },
        from: { id: 123456789, is_bot: false, first_name: 'Test' },
        voice: {
          file_id: 'voice123',
          file_unique_id: 'unique123',
          duration: 5
        }
      };

      const response = await bot.handleMessage(message);

      expect(response).toContain('Error');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await bot.start();
    });

    it('should handle MCP connection errors', async () => {
      mockMcpClient.isConnected.mockReturnValue(false);

      const message = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123456789, type: 'private' },
        from: { id: 123456789, is_bot: false, first_name: 'Test' },
        text: '/list'
      };

      const response = await bot.handleMessage(message);

      expect(response).toContain('MCP server is not connected');
    });

    it('should handle Ollama unavailable', async () => {
      mockOllamaClient.isAvailable.mockResolvedValue(false);

      const message = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123456789, type: 'private' },
        from: { id: 123456789, is_bot: false, first_name: 'Test' },
        voice: {
          file_id: 'voice123',
          file_unique_id: 'unique123',
          duration: 5
        }
      };

      const response = await bot.handleMessage(message);

      expect(response).toContain('Ollama service is not available');
    });

    it('should handle Whisper unavailable', async () => {
      mockWhisperClient.isAvailable.mockResolvedValue(false);

      const message = {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123456789, type: 'private' },
        from: { id: 123456789, is_bot: false, first_name: 'Test' },
        voice: {
          file_id: 'voice123',
          file_unique_id: 'unique123',
          duration: 5
        }
      };

      const response = await bot.handleMessage(message);

      expect(response).toContain('Whisper service is not available');
    });
  });

  describe('health check', () => {
    it('should return health status', async () => {
      await bot.start();

      const health = await bot.getHealthStatus();

      expect(health).toHaveProperty('bot');
      expect(health).toHaveProperty('mcp');
      expect(health).toHaveProperty('ollama');
      expect(health).toHaveProperty('whisper');
    });

    it('should detect unhealthy services', async () => {
      mockMcpClient.isConnected.mockReturnValue(false);
      await bot.start();

      const health = await bot.getHealthStatus();

      expect(health.mcp).toBe(false);
    });
  });
});

/**
 * Unit tests for voice handler
 * Following TDD: These tests should fail initially (RED phase)
 */

import { VoiceHandler } from '../../../src/telegram/handlers/voiceHandler';
import { Message as TelegramMessage, User as TelegramUser } from 'node-telegram-bot-api';
import { WhisperClient } from '../../../src/telegram/services/whisperClient';
import { OllamaClient } from '../../../src/telegram/services/ollamaClient';
import { MCPClient } from '../../../src/telegram/services/mcpClient';
import { SpeakerRecognition } from '../../../src/telegram/services/speakerRecognition';

// Mock dependencies
jest.mock('../../../src/telegram/services/whisperClient');
jest.mock('../../../src/telegram/services/ollamaClient');
jest.mock('../../../src/telegram/services/mcpClient');
jest.mock('../../../src/telegram/services/speakerRecognition');

describe('VoiceHandler', () => {
  let voiceHandler: VoiceHandler;
  let mockWhisperClient: jest.Mocked<WhisperClient>;
  let mockOllamaClient: jest.Mocked<OllamaClient>;
  let mockMcpClient: jest.Mocked<MCPClient>;
  let mockSpeakerRecognition: jest.Mocked<SpeakerRecognition>;

  beforeEach(() => {
    mockWhisperClient = {
      transcribe: jest.fn()
    } as any;

    mockOllamaClient = {
      generate: jest.fn(),
      isAvailable: jest.fn().mockResolvedValue(true)
    } as any;

    mockMcpClient = {
      callTool: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true)
    } as any;

    mockSpeakerRecognition = {
      diarize: jest.fn(),
      isEnabled: jest.fn().mockReturnValue(false)
    } as any;

    voiceHandler = new VoiceHandler(
      mockWhisperClient,
      mockOllamaClient,
      mockMcpClient,
      mockSpeakerRecognition
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create VoiceHandler with all dependencies', () => {
      expect(voiceHandler).toBeDefined();
      expect(voiceHandler).toBeInstanceOf(VoiceHandler);
    });

    it('should throw error if WhisperClient is undefined', () => {
      expect(() => new VoiceHandler(
        undefined as any,
        mockOllamaClient,
        mockMcpClient,
        mockSpeakerRecognition
      )).toThrow('WhisperClient is required');
    });

    it('should throw error if OllamaClient is undefined', () => {
      expect(() => new VoiceHandler(
        mockWhisperClient,
        undefined as any,
        mockMcpClient,
        mockSpeakerRecognition
      )).toThrow('OllamaClient is required');
    });

    it('should throw error if MCPClient is undefined', () => {
      expect(() => new VoiceHandler(
        mockWhisperClient,
        mockOllamaClient,
        undefined as any,
        mockSpeakerRecognition
      )).toThrow('MCPClient is required');
    });

    it('should allow SpeakerRecognition to be optional', () => {
      expect(() => new VoiceHandler(
        mockWhisperClient,
        mockOllamaClient,
        mockMcpClient
      )).not.toThrow();
    });
  });

  describe('handleVoiceMessage', () => {
    const createVoiceMessage = (): TelegramMessage => ({
      message_id: 1,
      date: Date.now(),
      chat: { id: 123, type: 'private' },
      from: { id: 123, is_bot: false, first_name: 'Test' },
      voice: {
        file_id: 'voice123',
        file_unique_id: 'unique123',
        duration: 5
      }
    });

    it('should transcribe voice message and return text', async () => {
      const message = createVoiceMessage();
      mockWhisperClient.transcribe.mockResolvedValue({
        text: 'Create a todo for buying groceries',
        language: 'en',
        duration: 5
      });

      const response = await voiceHandler.handleVoiceMessage(message, '/tmp/voice.ogg');

      expect(mockWhisperClient.transcribe).toHaveBeenCalledWith('/tmp/voice.ogg');
      expect(response).toContain('Create a todo for buying groceries');
    });

    it('should handle transcription errors', async () => {
      const message = createVoiceMessage();
      mockWhisperClient.transcribe.mockRejectedValue(new Error('Transcription failed'));

      await expect(voiceHandler.handleVoiceMessage(message, '/tmp/voice.ogg'))
        .rejects.toThrow('Transcription failed');
    });

    it('should process transcribed text with Ollama', async () => {
      const message = createVoiceMessage();
      mockWhisperClient.transcribe.mockResolvedValue({
        text: 'Create a todo for buying groceries tomorrow',
        language: 'en'
      });

      mockOllamaClient.generate.mockResolvedValue({
        model: 'llama2',
        response: JSON.stringify({
          action: 'create_todo',
          params: {
            text: 'Buy groceries',
            project: 'personal',
            dueDate: '2024-01-02'
          }
        }),
        done: true
      });

      mockMcpClient.callTool.mockResolvedValue({
        success: true,
        data: { id: '123', text: 'Buy groceries' }
      });

      const response = await voiceHandler.handleVoiceMessage(message, '/tmp/voice.ogg');

      expect(mockOllamaClient.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Create a todo for buying groceries tomorrow')
        })
      );
      expect(mockMcpClient.callTool).toHaveBeenCalledWith('create_todo', expect.any(Object));
      expect(response).toContain('Created');
    });

    it('should handle speaker diarization when enabled', async () => {
      mockSpeakerRecognition.isEnabled.mockReturnValue(true);
      mockSpeakerRecognition.diarize.mockResolvedValue({
        segments: [
          { speaker: 'Speaker 1', text: 'Create a todo', startTime: 0, endTime: 2 },
          { speaker: 'Speaker 2', text: 'for the meeting', startTime: 2, endTime: 4 }
        ],
        speakerCount: 2
      });

      const message = createVoiceMessage();
      mockWhisperClient.transcribe.mockResolvedValue({
        text: 'Create a todo for the meeting',
        language: 'en'
      });

      await voiceHandler.handleVoiceMessage(message, '/tmp/voice.ogg');

      expect(mockSpeakerRecognition.diarize).toHaveBeenCalledWith('/tmp/voice.ogg');
    });

    it('should handle empty transcription', async () => {
      const message = createVoiceMessage();
      mockWhisperClient.transcribe.mockResolvedValue({
        text: '',
        language: 'en'
      });

      const response = await voiceHandler.handleVoiceMessage(message, '/tmp/voice.ogg');

      expect(response).toContain('Could not transcribe');
      expect(mockOllamaClient.generate).not.toHaveBeenCalled();
    });

    it('should handle Ollama being unavailable', async () => {
      mockOllamaClient.isAvailable.mockResolvedValue(false);

      const message = createVoiceMessage();
      mockWhisperClient.transcribe.mockResolvedValue({
        text: 'Create a todo',
        language: 'en'
      });

      const response = await voiceHandler.handleVoiceMessage(message, '/tmp/voice.ogg');

      expect(response).toContain('Ollama service is not available');
    });
  });

  describe('downloadVoiceFile', () => {
    it('should download voice file from Telegram', async () => {
      const fileId = 'voice123';
      const expectedPath = '/tmp/voice_voice123.ogg';

      const filePath = await voiceHandler.downloadVoiceFile(fileId);

      expect(filePath).toBe(expectedPath);
    });

    it('should handle download errors', async () => {
      const fileId = 'invalid_file';

      await expect(voiceHandler.downloadVoiceFile(fileId))
        .rejects.toThrow('Failed to download voice file');
    });
  });

  describe('parseOllamaResponse', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        action: 'create_todo',
        params: { text: 'Test todo', project: 'work' }
      });

      const result = voiceHandler.parseOllamaResponse(response);

      expect(result.action).toBe('create_todo');
      expect(result.params).toEqual({ text: 'Test todo', project: 'work' });
    });

    it('should handle invalid JSON', () => {
      const response = 'Not a JSON response';

      expect(() => voiceHandler.parseOllamaResponse(response))
        .toThrow('Invalid Ollama response format');
    });

    it('should validate required fields', () => {
      const response = JSON.stringify({ params: { text: 'Test' } });

      expect(() => voiceHandler.parseOllamaResponse(response))
        .toThrow('Missing action field');
    });
  });

  describe('executeMCPAction', () => {
    it('should execute create_todo action', async () => {
      mockMcpClient.callTool.mockResolvedValue({
        success: true,
        data: { id: '123', text: 'Test todo' }
      });

      const result = await voiceHandler.executeMCPAction('create_todo', {
        text: 'Test todo',
        project: 'work'
      });

      expect(mockMcpClient.callTool).toHaveBeenCalledWith('create_todo', {
        text: 'Test todo',
        project: 'work'
      });
      expect(result.success).toBe(true);
    });

    it('should execute list_todos action', async () => {
      mockMcpClient.callTool.mockResolvedValue({
        success: true,
        data: { todos: [] }
      });

      const result = await voiceHandler.executeMCPAction('list_todos', {
        status: 'todo'
      });

      expect(mockMcpClient.callTool).toHaveBeenCalledWith('list_todos', {
        status: 'todo'
      });
      expect(result.success).toBe(true);
    });

    it('should handle unsupported actions', async () => {
      await expect(voiceHandler.executeMCPAction('invalid_action', {}))
        .rejects.toThrow('Unsupported action: invalid_action');
    });

    it('should handle MCP client errors', async () => {
      mockMcpClient.callTool.mockResolvedValue({
        success: false,
        error: 'Connection failed'
      });

      const result = await voiceHandler.executeMCPAction('create_todo', {
        text: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });
  });
});

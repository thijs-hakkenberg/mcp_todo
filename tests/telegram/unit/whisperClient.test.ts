/**
 * Unit tests for Whisper client
 * Following TDD: These tests should fail initially (RED phase)
 */

import { WhisperClient } from '../../../src/telegram/services/whisperClient';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
jest.mock('axios');
jest.mock('fs/promises');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WhisperClient', () => {
  let whisperClient: WhisperClient;
  const apiUrl = 'http://localhost:9000';
  const modelPath = '/path/to/whisper/model';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create WhisperClient with API URL', () => {
      whisperClient = new WhisperClient({ apiUrl });

      expect(whisperClient).toBeDefined();
      expect(whisperClient).toBeInstanceOf(WhisperClient);
    });

    it('should create WhisperClient with model path', () => {
      whisperClient = new WhisperClient({ modelPath });

      expect(whisperClient).toBeDefined();
      expect(whisperClient).toBeInstanceOf(WhisperClient);
    });

    it('should throw error if neither API URL nor model path provided', () => {
      expect(() => new WhisperClient({})).toThrow('Either apiUrl or modelPath is required');
    });

    it('should throw error if both API URL and model path provided', () => {
      expect(() => new WhisperClient({ apiUrl, modelPath }))
        .toThrow('Provide either apiUrl or modelPath, not both');
    });
  });

  describe('transcribe with API', () => {
    beforeEach(() => {
      whisperClient = new WhisperClient({ apiUrl });
    });

    it('should transcribe audio file via API', async () => {
      const mockResponse = {
        text: 'This is a test transcription',
        language: 'en',
        duration: 5.5
      };

      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('audio data'));
      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      const result = await whisperClient.transcribe('/tmp/audio.ogg');

      expect(fs.readFile).toHaveBeenCalledWith('/tmp/audio.ogg');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${apiUrl}/transcribe`,
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'multipart/form-data'
          })
        })
      );
      expect(result.text).toBe('This is a test transcription');
      expect(result.language).toBe('en');
      expect(result.duration).toBe(5.5);
    });

    it('should handle file read errors', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      await expect(whisperClient.transcribe('/tmp/nonexistent.ogg'))
        .rejects.toThrow('File not found');
    });

    it('should handle API errors', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('audio data'));
      mockedAxios.post.mockRejectedValue(new Error('API Error'));

      await expect(whisperClient.transcribe('/tmp/audio.ogg'))
        .rejects.toThrow('API Error');
    });

    it('should handle empty transcription', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('audio data'));
      mockedAxios.post.mockResolvedValue({ data: { text: '', language: 'en' } });

      const result = await whisperClient.transcribe('/tmp/audio.ogg');

      expect(result.text).toBe('');
    });

    it('should support custom language parameter', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('audio data'));
      mockedAxios.post.mockResolvedValue({
        data: { text: 'Test', language: 'es' }
      });

      await whisperClient.transcribe('/tmp/audio.ogg', { language: 'es' });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ language: 'es' }),
        expect.any(Object)
      );
    });
  });

  describe('transcribe with local model', () => {
    beforeEach(() => {
      whisperClient = new WhisperClient({ modelPath });
    });

    it('should transcribe audio file with local model', async () => {
      // This would require spawning a child process or using a native binding
      // For now, we'll test the interface
      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('audio data'));

      const result = await whisperClient.transcribe('/tmp/audio.ogg');

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('language');
    });

    it('should handle model loading errors', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('audio data'));

      // Simulate model not found
      await expect(whisperClient.transcribe('/tmp/audio.ogg'))
        .rejects.toThrow();
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is available', async () => {
      whisperClient = new WhisperClient({ apiUrl });
      mockedAxios.get.mockResolvedValue({ status: 200 });

      const result = await whisperClient.isAvailable();

      expect(result).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(`${apiUrl}/health`);
    });

    it('should return false when API is not available', async () => {
      whisperClient = new WhisperClient({ apiUrl });
      mockedAxios.get.mockRejectedValue(new Error('Connection refused'));

      const result = await whisperClient.isAvailable();

      expect(result).toBe(false);
    });

    it('should return true when local model exists', async () => {
      whisperClient = new WhisperClient({ modelPath });
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await whisperClient.isAvailable();

      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith(modelPath);
    });

    it('should return false when local model does not exist', async () => {
      whisperClient = new WhisperClient({ modelPath });
      (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));

      const result = await whisperClient.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('getSupportedFormats', () => {
    it('should return list of supported audio formats', () => {
      whisperClient = new WhisperClient({ apiUrl });

      const formats = whisperClient.getSupportedFormats();

      expect(formats).toContain('ogg');
      expect(formats).toContain('mp3');
      expect(formats).toContain('wav');
      expect(formats).toContain('m4a');
    });
  });

  describe('validateAudioFile', () => {
    beforeEach(() => {
      whisperClient = new WhisperClient({ apiUrl });
    });

    it('should validate supported audio format', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      await expect(whisperClient.validateAudioFile('/tmp/audio.ogg'))
        .resolves.not.toThrow();
    });

    it('should reject unsupported audio format', async () => {
      await expect(whisperClient.validateAudioFile('/tmp/audio.txt'))
        .rejects.toThrow('Unsupported audio format');
    });

    it('should reject non-existent file', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));

      await expect(whisperClient.validateAudioFile('/tmp/nonexistent.ogg'))
        .rejects.toThrow('File not found');
    });

    it('should reject files that are too large', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({
        size: 26 * 1024 * 1024 // 26MB (over 25MB limit)
      });

      await expect(whisperClient.validateAudioFile('/tmp/large.ogg'))
        .rejects.toThrow('File too large');
    });
  });
});

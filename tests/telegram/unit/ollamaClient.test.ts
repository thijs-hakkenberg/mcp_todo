/**
 * Unit tests for Ollama client
 * Following TDD: These tests should fail initially (RED phase)
 */

import { OllamaClient } from '../../../src/telegram/services/ollamaClient';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OllamaClient', () => {
  let ollamaClient: OllamaClient;
  const apiUrl = 'http://localhost:11434';

  beforeEach(() => {
    ollamaClient = new OllamaClient(apiUrl);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create OllamaClient with API URL', () => {
      expect(ollamaClient).toBeDefined();
      expect(ollamaClient).toBeInstanceOf(OllamaClient);
    });

    it('should throw error if API URL is empty', () => {
      expect(() => new OllamaClient('')).toThrow('Ollama API URL is required');
    });

    it('should throw error if API URL is undefined', () => {
      expect(() => new OllamaClient(undefined as any)).toThrow('Ollama API URL is required');
    });

    it('should normalize API URL without trailing slash', () => {
      const client = new OllamaClient('http://localhost:11434/');
      expect(client.getApiUrl()).toBe('http://localhost:11434');
    });
  });

  describe('generate', () => {
    it('should generate response from Ollama', async () => {
      const mockResponse = {
        model: 'llama2',
        response: 'This is a test response',
        done: true
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      const result = await ollamaClient.generate({
        model: 'llama2',
        prompt: 'Test prompt',
        stream: false
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${apiUrl}/api/generate`,
        expect.objectContaining({
          model: 'llama2',
          prompt: 'Test prompt',
          stream: false
        }),
        expect.any(Object)
      );
      expect(result.response).toBe('This is a test response');
      expect(result.done).toBe(true);
    });

    it('should use default model if not specified', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { model: 'llama2', response: 'test', done: true }
      });

      await ollamaClient.generate({
        prompt: 'Test prompt'
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          model: 'llama2'
        }),
        expect.any(Object)
      );
    });

    it('should handle streaming responses', async () => {
      const mockStreamResponse = {
        model: 'llama2',
        response: 'Partial response',
        done: false
      };

      mockedAxios.post.mockResolvedValue({ data: mockStreamResponse });

      const result = await ollamaClient.generate({
        model: 'llama2',
        prompt: 'Test prompt',
        stream: true
      });

      expect(result.done).toBe(false);
    });

    it('should handle API errors', async () => {
      mockedAxios.post.mockRejectedValue(new Error('API Error'));

      await expect(ollamaClient.generate({
        model: 'llama2',
        prompt: 'Test prompt'
      })).rejects.toThrow('API Error');
    });

    it('should handle network timeout', async () => {
      mockedAxios.post.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded'
      });

      await expect(ollamaClient.generate({
        model: 'llama2',
        prompt: 'Test prompt'
      })).rejects.toThrow();
    });

    it('should support custom options', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { model: 'llama2', response: 'test', done: true }
      });

      await ollamaClient.generate({
        model: 'llama2',
        prompt: 'Test prompt',
        options: {
          temperature: 0.8,
          top_p: 0.9,
          top_k: 40
        }
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          options: {
            temperature: 0.8,
            top_p: 0.9,
            top_k: 40
          }
        }),
        expect.any(Object)
      );
    });
  });

  describe('isAvailable', () => {
    it('should return true when Ollama is available', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });

      const result = await ollamaClient.isAvailable();

      expect(result).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(`${apiUrl}/api/tags`);
    });

    it('should return false when Ollama is not available', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Connection refused'));

      const result = await ollamaClient.isAvailable();

      expect(result).toBe(false);
    });

    it('should return false on timeout', async () => {
      mockedAxios.get.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout'
      });

      const result = await ollamaClient.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('listModels', () => {
    it('should list available models', async () => {
      const mockModels = {
        models: [
          { name: 'llama2', size: 3825819519 },
          { name: 'mistral', size: 4109865159 }
        ]
      };

      mockedAxios.get.mockResolvedValue({ data: mockModels });

      const result = await ollamaClient.listModels();

      expect(mockedAxios.get).toHaveBeenCalledWith(`${apiUrl}/api/tags`);
      expect(result).toEqual(mockModels.models);
    });

    it('should handle empty model list', async () => {
      mockedAxios.get.mockResolvedValue({ data: { models: [] } });

      const result = await ollamaClient.listModels();

      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      await expect(ollamaClient.listModels()).rejects.toThrow('API Error');
    });
  });

  describe('getApiUrl', () => {
    it('should return the configured API URL', () => {
      expect(ollamaClient.getApiUrl()).toBe(apiUrl);
    });
  });

  describe('setDefaultModel', () => {
    it('should set default model', () => {
      ollamaClient.setDefaultModel('mistral');

      // Verify by checking if generate uses the new default
      mockedAxios.post.mockResolvedValue({
        data: { model: 'mistral', response: 'test', done: true }
      });

      ollamaClient.generate({ prompt: 'Test' });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ model: 'mistral' }),
        expect.any(Object)
      );
    });

    it('should throw error for empty model name', () => {
      expect(() => ollamaClient.setDefaultModel('')).toThrow('Model name is required');
    });
  });
});

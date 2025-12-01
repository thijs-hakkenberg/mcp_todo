/**
 * Unit tests for speaker recognition/diarization
 * Following TDD: These tests should fail initially (RED phase)
 */

import { SpeakerRecognition } from '../../../src/telegram/services/speakerRecognition';
import * as fs from 'fs/promises';

// Mock dependencies
jest.mock('fs/promises');

describe('SpeakerRecognition', () => {
  let speakerRecognition: SpeakerRecognition;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create SpeakerRecognition with default settings', () => {
      speakerRecognition = new SpeakerRecognition();

      expect(speakerRecognition).toBeDefined();
      expect(speakerRecognition).toBeInstanceOf(SpeakerRecognition);
      expect(speakerRecognition.isEnabled()).toBe(false);
    });

    it('should create SpeakerRecognition with enabled flag', () => {
      speakerRecognition = new SpeakerRecognition({ enabled: true });

      expect(speakerRecognition.isEnabled()).toBe(true);
    });

    it('should accept custom configuration', () => {
      speakerRecognition = new SpeakerRecognition({
        enabled: true,
        minSpeakers: 2,
        maxSpeakers: 5
      });

      expect(speakerRecognition.isEnabled()).toBe(true);
    });
  });

  describe('diarize', () => {
    beforeEach(() => {
      speakerRecognition = new SpeakerRecognition({ enabled: true });
    });

    it('should perform speaker diarization on audio file', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('audio data'));

      const result = await speakerRecognition.diarize('/tmp/audio.ogg');

      expect(result).toHaveProperty('segments');
      expect(result).toHaveProperty('speakerCount');
      expect(Array.isArray(result.segments)).toBe(true);
    });

    it('should identify multiple speakers', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('audio data'));

      const result = await speakerRecognition.diarize('/tmp/audio.ogg');

      expect(result.speakerCount).toBeGreaterThanOrEqual(1);
      if (result.segments.length > 0) {
        expect(result.segments[0]).toHaveProperty('speaker');
        expect(result.segments[0]).toHaveProperty('text');
        expect(result.segments[0]).toHaveProperty('startTime');
        expect(result.segments[0]).toHaveProperty('endTime');
      }
    });

    it('should handle single speaker audio', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('audio data'));

      const result = await speakerRecognition.diarize('/tmp/audio.ogg');

      expect(result.speakerCount).toBe(1);
      expect(result.segments.length).toBeGreaterThanOrEqual(1);
    });

    it('should throw error when disabled', async () => {
      speakerRecognition = new SpeakerRecognition({ enabled: false });

      await expect(speakerRecognition.diarize('/tmp/audio.ogg'))
        .rejects.toThrow('Speaker recognition is not enabled');
    });

    it('should handle file read errors', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      await expect(speakerRecognition.diarize('/tmp/nonexistent.ogg'))
        .rejects.toThrow('File not found');
    });

    it('should respect min/max speaker constraints', async () => {
      speakerRecognition = new SpeakerRecognition({
        enabled: true,
        minSpeakers: 2,
        maxSpeakers: 4
      });

      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('audio data'));

      const result = await speakerRecognition.diarize('/tmp/audio.ogg');

      expect(result.speakerCount).toBeGreaterThanOrEqual(2);
      expect(result.speakerCount).toBeLessThanOrEqual(4);
    });
  });

  describe('isEnabled', () => {
    it('should return false by default', () => {
      speakerRecognition = new SpeakerRecognition();

      expect(speakerRecognition.isEnabled()).toBe(false);
    });

    it('should return true when enabled', () => {
      speakerRecognition = new SpeakerRecognition({ enabled: true });

      expect(speakerRecognition.isEnabled()).toBe(true);
    });
  });

  describe('setEnabled', () => {
    beforeEach(() => {
      speakerRecognition = new SpeakerRecognition();
    });

    it('should enable speaker recognition', () => {
      speakerRecognition.setEnabled(true);

      expect(speakerRecognition.isEnabled()).toBe(true);
    });

    it('should disable speaker recognition', () => {
      speakerRecognition = new SpeakerRecognition({ enabled: true });
      speakerRecognition.setEnabled(false);

      expect(speakerRecognition.isEnabled()).toBe(false);
    });
  });

  describe('getSpeakerLabels', () => {
    beforeEach(() => {
      speakerRecognition = new SpeakerRecognition({ enabled: true });
    });

    it('should return speaker labels for segments', () => {
      const segments = [
        { speaker: 'Speaker 1', text: 'Hello', startTime: 0, endTime: 1 },
        { speaker: 'Speaker 2', text: 'Hi', startTime: 1, endTime: 2 },
        { speaker: 'Speaker 1', text: 'How are you?', startTime: 2, endTime: 3 }
      ];

      const labels = speakerRecognition.getSpeakerLabels(segments);

      expect(labels).toContain('Speaker 1');
      expect(labels).toContain('Speaker 2');
      expect(labels.length).toBe(2);
    });

    it('should handle empty segments', () => {
      const labels = speakerRecognition.getSpeakerLabels([]);

      expect(labels).toEqual([]);
    });
  });

  describe('mergeSpeakerSegments', () => {
    beforeEach(() => {
      speakerRecognition = new SpeakerRecognition({ enabled: true });
    });

    it('should merge consecutive segments from same speaker', () => {
      const segments = [
        { speaker: 'Speaker 1', text: 'Hello', startTime: 0, endTime: 1 },
        { speaker: 'Speaker 1', text: 'there', startTime: 1, endTime: 2 },
        { speaker: 'Speaker 2', text: 'Hi', startTime: 2, endTime: 3 }
      ];

      const merged = speakerRecognition.mergeSpeakerSegments(segments);

      expect(merged.length).toBe(2);
      expect(merged[0].text).toBe('Hello there');
      expect(merged[0].endTime).toBe(2);
    });

    it('should not merge segments from different speakers', () => {
      const segments = [
        { speaker: 'Speaker 1', text: 'Hello', startTime: 0, endTime: 1 },
        { speaker: 'Speaker 2', text: 'Hi', startTime: 1, endTime: 2 }
      ];

      const merged = speakerRecognition.mergeSpeakerSegments(segments);

      expect(merged.length).toBe(2);
    });

    it('should handle empty segments', () => {
      const merged = speakerRecognition.mergeSpeakerSegments([]);

      expect(merged).toEqual([]);
    });
  });

  describe('formatDiarization', () => {
    beforeEach(() => {
      speakerRecognition = new SpeakerRecognition({ enabled: true });
    });

    it('should format diarization result as text', () => {
      const result = {
        segments: [
          { speaker: 'Speaker 1', text: 'Hello', startTime: 0, endTime: 1 },
          { speaker: 'Speaker 2', text: 'Hi there', startTime: 1, endTime: 2 }
        ],
        speakerCount: 2
      };

      const formatted = speakerRecognition.formatDiarization(result);

      expect(formatted).toContain('Speaker 1: Hello');
      expect(formatted).toContain('Speaker 2: Hi there');
    });

    it('should include timestamps when requested', () => {
      const result = {
        segments: [
          { speaker: 'Speaker 1', text: 'Hello', startTime: 0, endTime: 1 }
        ],
        speakerCount: 1
      };

      const formatted = speakerRecognition.formatDiarization(result, { includeTimestamps: true });

      expect(formatted).toContain('[0.0s - 1.0s]');
      expect(formatted).toContain('Speaker 1: Hello');
    });

    it('should handle empty result', () => {
      const result = {
        segments: [],
        speakerCount: 0
      };

      const formatted = speakerRecognition.formatDiarization(result);

      expect(formatted).toBe('');
    });
  });
});

/**
 * Unit tests for authentication handler
 * Following TDD: These tests should fail initially (RED phase)
 */

import { AuthHandler } from '../../../src/telegram/handlers/authHandler';
import { User as TelegramUser } from 'node-telegram-bot-api';

describe('AuthHandler', () => {
  let authHandler: AuthHandler;
  const authorizedUserId = '123456789';

  beforeEach(() => {
    authHandler = new AuthHandler(authorizedUserId);
  });

  describe('constructor', () => {
    it('should create AuthHandler with authorized user ID', () => {
      expect(authHandler).toBeDefined();
      expect(authHandler).toBeInstanceOf(AuthHandler);
    });

    it('should throw error if authorized user ID is empty', () => {
      expect(() => new AuthHandler('')).toThrow('Authorized user ID is required');
    });

    it('should throw error if authorized user ID is undefined', () => {
      expect(() => new AuthHandler(undefined as any)).toThrow('Authorized user ID is required');
    });
  });

  describe('isAuthorized', () => {
    it('should return true for authorized user', () => {
      const user: TelegramUser = {
        id: 123456789,
        is_bot: false,
        first_name: 'Test User'
      };

      const result = authHandler.isAuthorized(user);

      expect(result.authorized).toBe(true);
      expect(result.userId).toBe('123456789');
      expect(result.username).toBe('Test User');
    });

    it('should return false for unauthorized user', () => {
      const user: TelegramUser = {
        id: 987654321,
        is_bot: false,
        first_name: 'Unauthorized User'
      };

      const result = authHandler.isAuthorized(user);

      expect(result.authorized).toBe(false);
      expect(result.userId).toBe('987654321');
    });

    it('should return false for bot users', () => {
      const user: TelegramUser = {
        id: 123456789,
        is_bot: true,
        first_name: 'Bot'
      };

      const result = authHandler.isAuthorized(user);

      expect(result.authorized).toBe(false);
    });

    it('should handle user with username', () => {
      const user: TelegramUser = {
        id: 123456789,
        is_bot: false,
        first_name: 'Test',
        username: 'testuser'
      };

      const result = authHandler.isAuthorized(user);

      expect(result.authorized).toBe(true);
      expect(result.username).toBe('testuser');
    });

    it('should throw error if user is undefined', () => {
      expect(() => authHandler.isAuthorized(undefined as any)).toThrow('User is required');
    });
  });

  describe('getAuthorizedUserId', () => {
    it('should return the authorized user ID', () => {
      expect(authHandler.getAuthorizedUserId()).toBe(authorizedUserId);
    });
  });
});

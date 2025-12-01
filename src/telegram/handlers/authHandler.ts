/**
 * Authentication handler for Telegram bot
 * Implements single-user authorization
 */

import { User as TelegramUser } from 'node-telegram-bot-api';
import { AuthResult } from '../types/telegram';

export class AuthHandler {
  private authorizedUserId: string;

  constructor(authorizedUserId: string) {
    if (!authorizedUserId || authorizedUserId.trim() === '') {
      throw new Error('Authorized user ID is required');
    }
    this.authorizedUserId = authorizedUserId;
  }

  /**
   * Check if a user is authorized to use the bot
   */
  public isAuthorized(user: TelegramUser): AuthResult {
    if (!user) {
      throw new Error('User is required');
    }

    const userId = user.id.toString();
    const username = user.username || user.first_name;

    // Reject bot users
    if (user.is_bot) {
      console.log(`Rejected bot user: ${username} (${userId})`);
      return {
        authorized: false,
        userId,
        username
      };
    }

    // Check if user ID matches authorized user
    const authorized = userId === this.authorizedUserId;

    if (!authorized) {
      console.log(`Unauthorized access attempt by user: ${username} (${userId})`);
    }

    return {
      authorized,
      userId,
      username
    };
  }

  /**
   * Get the authorized user ID
   */
  public getAuthorizedUserId(): string {
    return this.authorizedUserId;
  }
}

/**
 * Type definitions for Telegram bot
 */

// TODO: Install node-telegram-bot-api dependency
// import { Message as TelegramMessage, User as TelegramUser } from 'node-telegram-bot-api';

/**
 * Placeholder types until node-telegram-bot-api is installed
 */
export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: any;
  date: number;
  text?: string;
  voice?: any;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

/**
 * Bot configuration options
 */
export interface BotConfig {
  token: string;
  authorizedUserId: string;
  ollamaApiUrl: string;
  whisperApiUrl?: string;
  whisperModelPath?: string;
}

/**
 * Authentication result
 */
export interface AuthResult {
  authorized: boolean;
  userId: string;
  username?: string;
}

/**
 * Voice transcription result
 */
export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  confidence?: number;
}

/**
 * Speaker diarization result
 */
export interface SpeakerSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

export interface DiarizationResult {
  segments: SpeakerSegment[];
  speakerCount: number;
}

/**
 * Ollama API request/response types
 */
export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
  };
}

export interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
}

/**
 * Command handler context
 */
export interface CommandContext {
  message: TelegramMessage;
  user: TelegramUser;
  args: string[];
}

/**
 * Voice handler context
 */
export interface VoiceContext {
  message: TelegramMessage;
  user: TelegramUser;
  fileId: string;
  duration: number;
}

/**
 * MCP tool execution result
 */
export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

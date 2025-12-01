/**
 * Main Telegram bot implementation
 * Integrates authentication, command handling, and MCP client
 */

import TelegramBot from 'node-telegram-bot-api';
import { AuthHandler } from './handlers/authHandler';
import { CommandHandler } from './handlers/commandHandler';
import { MCPClient } from './services/mcpClient';

export interface BotConfig {
  token: string;
  authorizedUserId: string;
  mcpServerPath: string;
}

export class TodoBot {
  private bot: TelegramBot;
  private authHandler: AuthHandler;
  private commandHandler: CommandHandler;
  private mcpClient: MCPClient;

  constructor(config: BotConfig) {
    this.validateConfig(config);

    // Initialize bot
    this.bot = new TelegramBot(config.token, { polling: false });

    // Initialize handlers
    this.authHandler = new AuthHandler(config.authorizedUserId);
    this.mcpClient = new MCPClient(config.mcpServerPath);
    this.commandHandler = new CommandHandler(this.mcpClient);
  }

  /**
   * Validate bot configuration
   */
  private validateConfig(config: BotConfig): void {
    if (!config.token || config.token.trim() === '') {
      throw new Error('Bot token is required');
    }
    if (!config.authorizedUserId || config.authorizedUserId.trim() === '') {
      throw new Error('Authorized user ID is required');
    }
    if (!config.mcpServerPath || config.mcpServerPath.trim() === '') {
      throw new Error('MCP server path is required');
    }
  }

  /**
   * Initialize and start the bot
   */
  public async start(): Promise<void> {
    try {
      // Connect to MCP server
      console.log('Connecting to MCP server...');
      await this.mcpClient.connect();
      console.log('Connected to MCP server');

      // Set up command handlers
      this.setupCommandHandlers();

      // Start polling
      await this.bot.startPolling();
      console.log('Bot started successfully');
    } catch (error) {
      console.error('Failed to start bot:', error);
      throw error;
    }
  }

  /**
   * Stop the bot
   */
  public async stop(): Promise<void> {
    try {
      await this.bot.stopPolling();
      await this.mcpClient.disconnect();
      console.log('Bot stopped');
    } catch (error) {
      console.error('Error stopping bot:', error);
      throw error;
    }
  }

  /**
   * Set up command handlers with authentication middleware
   */
  private setupCommandHandlers(): void {
    // /start command
    this.bot.onText(/\/start/, async (msg) => {
      await this.handleCommand(msg, async () => {
        return await this.commandHandler.handleStart(msg);
      });
    });

    // /help command
    this.bot.onText(/\/help/, async (msg) => {
      await this.handleCommand(msg, async () => {
        return await this.commandHandler.handleHelp(msg);
      });
    });

    // /list command
    this.bot.onText(/\/list/, async (msg) => {
      await this.handleCommand(msg, async () => {
        return await this.commandHandler.handleList(msg);
      });
    });

    // /create command
    this.bot.onText(/\/create/, async (msg) => {
      await this.handleCommand(msg, async () => {
        return await this.commandHandler.handleCreate(msg);
      });
    });

    // /update command
    this.bot.onText(/\/update/, async (msg) => {
      await this.handleCommand(msg, async () => {
        return await this.commandHandler.handleUpdate(msg);
      });
    });

    // /complete command
    this.bot.onText(/\/complete/, async (msg) => {
      await this.handleCommand(msg, async () => {
        return await this.commandHandler.handleComplete(msg);
      });
    });

    // /delete command
    this.bot.onText(/\/delete/, async (msg) => {
      await this.handleCommand(msg, async () => {
        return await this.commandHandler.handleDelete(msg);
      });
    });

    // Error handling
    this.bot.on('polling_error', (error) => {
      console.error('Polling error:', error);
    });
  }

  /**
   * Handle command with authentication middleware
   */
  private async handleCommand(
    msg: TelegramBot.Message,
    handler: () => Promise<string>
  ): Promise<void> {
    try {
      // Check authentication
      if (!msg.from) {
        return;
      }

      const authResult = this.authHandler.isAuthorized(msg.from);

      if (!authResult.authorized) {
        await this.bot.sendMessage(
          msg.chat.id,
          '❌ Sorry, you are not authorized to use this bot.'
        );
        return;
      }

      // Execute command handler
      const response = await handler();

      // Send response
      await this.bot.sendMessage(msg.chat.id, response, {
        parse_mode: 'Markdown'
      });
    } catch (error: any) {
      console.error('Error handling command:', error);
      await this.bot.sendMessage(
        msg.chat.id,
        `❌ An error occurred: ${error.message}`
      );
    }
  }

  /**
   * Get bot instance (for testing)
   */
  public getBot(): TelegramBot {
    return this.bot;
  }

  /**
   * Get MCP client (for testing)
   */
  public getMCPClient(): MCPClient {
    return this.mcpClient;
  }

  /**
   * Get auth handler (for testing)
   */
  public getAuthHandler(): AuthHandler {
    return this.authHandler;
  }
}

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): BotConfig {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const authorizedUserId = process.env.TELEGRAM_AUTHORIZED_USER_ID;
  const mcpServerPath = process.env.MCP_SERVER_PATH || 'dist/index.js';

  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
  }
  if (!authorizedUserId) {
    throw new Error('TELEGRAM_AUTHORIZED_USER_ID environment variable is required');
  }

  return {
    token,
    authorizedUserId,
    mcpServerPath
  };
}

/**
 * Main entry point
 */
export async function main(): Promise<void> {
  try {
    const config = loadConfigFromEnv();
    const bot = new TodoBot(config);
    await bot.start();

    // Handle shutdown signals
    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down...');
      await bot.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down...');
      await bot.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

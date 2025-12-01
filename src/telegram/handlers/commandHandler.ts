/**
 * Command handler for Telegram bot
 * Parses and handles todo commands
 */

import { Message as TelegramMessage } from 'node-telegram-bot-api';
import { MCPClient } from '../services/mcpClient';

interface ParsedCommand {
  command: string;
  args: string[];
  params: Record<string, any>;
}

export class CommandHandler {
  private mcpClient: MCPClient;

  constructor(mcpClient: MCPClient) {
    if (!mcpClient) {
      throw new Error('MCP client is required');
    }
    this.mcpClient = mcpClient;
  }

  /**
   * Handle /start command
   */
  public async handleStart(_message: TelegramMessage): Promise<string> {
    return `Welcome to the Todo Bot! 🎉

I can help you manage your todos through simple commands or natural language.

Use /help to see available commands.`;
  }

  /**
   * Handle /help command
   */
  public async handleHelp(_message: TelegramMessage): Promise<string> {
    return `Available Commands:

/start - Show welcome message
/help - Show this help message
/list [filters] - List todos
  Filters: status:todo, priority:high, project:work
/create <text> [params] - Create a new todo
  Params: project:name, priority:high, tags:tag1,tag2
/update <id> [params] - Update a todo
  Params: text:new text, status:done, priority:high
/complete <id> - Mark todo as complete
/delete <id> - Delete a todo

Examples:
/list status:todo
/create Buy groceries project:personal priority:high
/update abc123 status:in-progress
/complete abc123`;
  }

  /**
   * Handle /list command
   */
  public async handleList(message: TelegramMessage): Promise<string> {
    try {
      const parsed = this.parseCommand(message.text || '/list');
      const filters: any = {};

      // Extract filters from params
      if (parsed.params.status) {
        filters.status = parsed.params.status;
      }
      if (parsed.params.priority) {
        filters.priority = parsed.params.priority;
      }
      if (parsed.params.project) {
        filters.project = parsed.params.project;
      }
      if (parsed.params.tags) {
        filters.tags = parsed.params.tags;
      }

      const result = await this.mcpClient.callTool('list_todos', filters);

      if (!result.success) {
        return `Error: ${result.error}`;
      }

      const todos = result.data?.todos || [];

      if (todos.length === 0) {
        return 'No todos found.';
      }

      // Format todos for display
      let response = `📋 Your Todos (${todos.length}):\n\n`;

      for (const todo of todos) {
        const statusEmoji = this.getStatusEmoji(todo.status);
        const priorityEmoji = this.getPriorityEmoji(todo.priority);
        response += `${statusEmoji} ${priorityEmoji} ${todo.text}\n`;
        response += `   ID: ${todo.id}\n`;
        if (todo.project) {
          response += `   Project: ${todo.project}\n`;
        }
        response += '\n';
      }

      return response.trim();
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  }

  /**
   * Handle /create command
   */
  public async handleCreate(message: TelegramMessage): Promise<string> {
    try {
      const parsed = this.parseCommand(message.text || '');

      // Extract todo text from args (everything that's not a param)
      const todoText = parsed.args.join(' ').trim();

      if (!todoText) {
        return `Usage: /create <text> [params]

Example: /create Buy groceries project:personal priority:high tags:shopping,urgent`;
      }

      const createParams: any = {
        text: todoText
      };

      // Add optional parameters
      if (parsed.params.project) {
        createParams.project = parsed.params.project;
      }
      if (parsed.params.priority) {
        createParams.priority = parsed.params.priority;
      }
      if (parsed.params.tags) {
        createParams.tags = parsed.params.tags;
      }
      if (parsed.params.assignee) {
        createParams.assignee = parsed.params.assignee;
      }
      if (parsed.params.dueDate) {
        createParams.dueDate = parsed.params.dueDate;
      }

      // Default project if not specified
      if (!createParams.project) {
        createParams.project = 'default';
      }

      const result = await this.mcpClient.callTool('create_todo', createParams);

      if (!result.success) {
        return `Error: ${result.error}`;
      }

      const todo = result.data;
      return `✅ Created todo: ${todo.text}\nID: ${todo.id}`;
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  }

  /**
   * Handle /update command
   */
  public async handleUpdate(message: TelegramMessage): Promise<string> {
    try {
      const parsed = this.parseCommand(message.text || '');

      if (parsed.args.length === 0) {
        return `Usage: /update <id> [params]

Example: /update abc123 text:Updated text status:in-progress priority:high`;
      }

      const todoId = parsed.args[0];
      const updateParams: any = { id: todoId };

      // Add update parameters
      if (parsed.params.text) {
        updateParams.text = parsed.params.text;
      }
      if (parsed.params.status) {
        updateParams.status = parsed.params.status;
      }
      if (parsed.params.priority) {
        updateParams.priority = parsed.params.priority;
      }
      if (parsed.params.project) {
        updateParams.project = parsed.params.project;
      }
      if (parsed.params.tags) {
        updateParams.tags = parsed.params.tags;
      }

      const result = await this.mcpClient.callTool('update_todo', updateParams);

      if (!result.success) {
        return `Error: ${result.error}`;
      }

      return `✅ Updated todo: ${todoId}`;
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  }

  /**
   * Handle /complete command
   */
  public async handleComplete(message: TelegramMessage): Promise<string> {
    try {
      const parsed = this.parseCommand(message.text || '');

      if (parsed.args.length === 0) {
        return 'Usage: /complete <id>';
      }

      const todoId = parsed.args[0];
      const result = await this.mcpClient.callTool('complete_todo', { id: todoId });

      if (!result.success) {
        return `Error: ${result.error}`;
      }

      return `✅ Completed todo: ${todoId}`;
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  }

  /**
   * Handle /delete command
   */
  public async handleDelete(message: TelegramMessage): Promise<string> {
    try {
      const parsed = this.parseCommand(message.text || '');

      if (parsed.args.length === 0) {
        return 'Usage: /delete <id>';
      }

      const todoId = parsed.args[0];
      const result = await this.mcpClient.callTool('delete_todo', { id: todoId });

      if (!result.success) {
        return `Error: ${result.error}`;
      }

      return `✅ Deleted todo: ${todoId}`;
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  }

  /**
   * Parse command text into structured format
   */
  public parseCommand(text: string): ParsedCommand {
    const parts = text.trim().split(/\s+/);
    const command = parts[0].replace('/', '');
    const args: string[] = [];
    const params: Record<string, any> = {};

    let i = 1;
    while (i < parts.length) {
      const part = parts[i];

      // Check if this is a parameter (key:value)
      if (part.includes(':')) {
        const colonIndex = part.indexOf(':');
        const key = part.substring(0, colonIndex);
        let value = part.substring(colonIndex + 1);

        // If value is empty, collect remaining words until next param or end
        if (!value || value.trim() === '') {
          i++;
          const valueParts: string[] = [];
          while (i < parts.length && !parts[i].includes(':')) {
            valueParts.push(parts[i]);
            i++;
          }
          value = valueParts.join(' ');
          i--; // Back up one since we'll increment at the end
        } else {
          // Check if next parts are continuation of value (not params)
          const valueParts = [value];
          let j = i + 1;
          while (j < parts.length && !parts[j].includes(':')) {
            valueParts.push(parts[j]);
            j++;
          }
          if (j > i + 1) {
            value = valueParts.join(' ');
            i = j - 1;
          }
        }

        // Handle tags as array
        if (key === 'tags') {
          params[key] = value.split(',').map(t => t.trim());
        } else {
          params[key] = value;
        }
      } else {
        // Regular argument
        args.push(part);
      }

      i++;
    }

    return { command, args, params };
  }

  /**
   * Get emoji for todo status
   */
  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'todo':
        return '⚪';
      case 'in-progress':
        return '🔵';
      case 'blocked':
        return '🔴';
      case 'done':
        return '✅';
      default:
        return '⚪';
    }
  }

  /**
   * Get emoji for todo priority
   */
  private getPriorityEmoji(priority: string): string {
    switch (priority) {
      case 'urgent':
        return '🔥';
      case 'high':
        return '⬆️';
      case 'medium':
        return '➡️';
      case 'low':
        return '⬇️';
      default:
        return '➡️';
    }
  }
}

/**
 * MCP Server implementation for todo operations
 *
 * This is the main orchestrator that routes tool calls to appropriate handlers.
 * Tool definitions and handlers are extracted into separate modules for maintainability.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { TodoRepository } from '../data/TodoRepository';
import { SyncManager } from '../git/SyncManager';
import { GitManager } from '../git/GitManager';
import { getToolDefinitions } from './tools';
import { TodoHandlers, FilterHandlers, SyncHandlers } from './handlers';
import { errorResponse } from './utils/response';

export class MCPServer {
  private todoHandlers: TodoHandlers;
  private filterHandlers: FilterHandlers;
  private syncHandlers: SyncHandlers;

  constructor(
    todoRepo: TodoRepository,
    syncManager: SyncManager,
    gitManager: GitManager
  ) {
    this.todoHandlers = new TodoHandlers(todoRepo, syncManager);
    this.filterHandlers = new FilterHandlers(todoRepo);
    this.syncHandlers = new SyncHandlers(todoRepo, syncManager, gitManager);
  }

  /**
   * Get list of available tools
   */
  getTools(): Tool[] {
    return getToolDefinitions();
  }

  /**
   * Handle tool call
   */
  async handleToolCall(name: string, args: any): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      switch (name) {
        // Todo CRUD operations
        case 'list_todos':
          return await this.todoHandlers.handleListTodos(args);
        case 'get_todo':
          return await this.todoHandlers.handleGetTodo(args);
        case 'create_todo':
          return await this.todoHandlers.handleCreateTodo(args);
        case 'update_todo':
          return await this.todoHandlers.handleUpdateTodo(args);
        case 'delete_todo':
          return await this.todoHandlers.handleDeleteTodo(args);
        case 'complete_todo':
          return await this.todoHandlers.handleCompleteTodo(args);
        case 'add_comment':
          return await this.todoHandlers.handleAddComment(args);
        case 'search_todos':
          return await this.todoHandlers.handleSearchTodos(args);
        case 'batch_create_todos':
          return await this.todoHandlers.handleBatchCreateTodos(args);

        // Filter options
        case 'get_projects':
          return await this.filterHandlers.handleGetProjects(args);
        case 'get_tags':
          return await this.filterHandlers.handleGetTags(args);
        case 'get_assignees':
          return await this.filterHandlers.handleGetAssignees(args);
        case 'get_priorities':
          return await this.filterHandlers.handleGetPriorities(args);
        case 'get_filter_options':
          return await this.filterHandlers.handleGetFilterOptions(args);

        // Sync and stats
        case 'get_stats':
          return await this.syncHandlers.handleGetStats(args);
        case 'sync_repository':
          return await this.syncHandlers.handleSyncRepository(args);
        case 'get_history':
          return await this.syncHandlers.handleGetHistory(args);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }
}

/**
 * Sync Handlers for MCP Server
 *
 * Handles repository sync and history operations.
 */

import { TodoRepository } from '../../data/TodoRepository';
import { SyncManager } from '../../git/SyncManager';
import { GitManager } from '../../git/GitManager';
import { successResponse, MCPToolResponse } from '../utils/response';

export class SyncHandlers {
  constructor(
    private todoRepo: TodoRepository,
    private syncManager: SyncManager,
    private gitManager: GitManager
  ) {}

  async handleGetStats(_args: any): Promise<MCPToolResponse> {
    const stats = await this.todoRepo.getStats();
    const syncStats = this.syncManager.getStats();
    return successResponse({ todoStats: stats, syncStats });
  }

  async handleSyncRepository(_args: any): Promise<MCPToolResponse> {
    const result = await this.syncManager.sync();
    return successResponse({
      hasConflicts: result.hasConflicts,
      resolvedConflicts: result.resolvedConflicts,
      error: result.error
    });
  }

  async handleGetHistory(args: any): Promise<MCPToolResponse> {
    const limit = args.limit || 10;

    // Get git log for directory-based persistence (tracks changes in tasks/ directory)
    const git = (this.gitManager as any).git;
    const log = await git.log(['-n', limit.toString(), '--', 'tasks/']);

    return successResponse({
      commits: log.all.map((commit: any) => ({
        hash: commit.hash,
        date: commit.date,
        message: commit.message,
        author: commit.author_name
      }))
    });
  }
}

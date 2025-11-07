import { GitManager } from './GitManager';
import { TodoRepository } from '../data/TodoRepository';
import { CreateTodoInput, UpdateTodoInput, Todo } from '../types/Todo';

export interface SyncResult {
  success: boolean;
  hasConflicts: boolean;
  resolvedConflicts?: string[];
  error?: string;
  syncTime?: number;
}

export interface SyncStats {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  conflictsResolved: number;
  lastSyncTime?: number;
  lastError?: string;
}

/**
 * Manages synchronization between local and remote repositories
 */
export class SyncManager {
  private gitManager: GitManager;
  private todoRepo: TodoRepository;
  private syncing = false;
  private syncQueue: Array<() => Promise<any>> = [];
  private autoSyncInterval?: NodeJS.Timeout;
  private syncOnWrite = false;
  private debounceTimeout?: NodeJS.Timeout;
  private debounceMs = 0;
  private lastSyncTime?: number;
  private lastSyncError?: string;
  private stats: SyncStats = {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    conflictsResolved: 0
  };

  constructor(gitManager: GitManager, todoRepo: TodoRepository) {
    this.gitManager = gitManager;
    this.todoRepo = todoRepo;
  }

  /**
   * Perform a full sync (pull, merge, commit, push)
   */
  async sync(): Promise<SyncResult> {
    if (this.syncing) {
      // Queue the sync or reject
      return {
        success: false,
        hasConflicts: false,
        error: 'Sync already in progress'
      };
    }

    this.syncing = true;
    this.stats.totalSyncs++;

    try {
      // Pull from remote
      const pullResult = await this.gitManager.pull();

      if (!pullResult.success) {
        if (pullResult.hasConflicts) {
          // Resolve conflicts
          await this.resolveConflicts(pullResult.conflictedFiles || []);

          // Commit resolution
          await this.gitManager.commit('Resolved merge conflicts');

          // Push changes
          const pushResult = await this.gitManager.push();

          if (!pushResult.success) {
            throw new Error(pushResult.error || 'Push failed after conflict resolution');
          }

          this.stats.conflictsResolved++;
          this.lastSyncTime = Date.now();
          this.stats.successfulSyncs++;

          // Reload todos after sync
          await this.todoRepo.reload();

          return {
            success: true,
            hasConflicts: true,
            resolvedConflicts: pullResult.conflictedFiles,
            syncTime: this.lastSyncTime
          };
        } else {
          throw new Error(pullResult.error || 'Pull failed');
        }
      }

      // Push any local changes
      const pushResult = await this.gitManager.push();

      if (!pushResult.success) {
        if (pushResult.needsPull) {
          // Recursive sync to handle race condition
          this.syncing = false;
          return this.sync();
        } else {
          throw new Error(pushResult.error || 'Push failed');
        }
      }

      // Reload todos after successful sync
      await this.todoRepo.reload();

      this.lastSyncTime = Date.now();
      this.stats.successfulSyncs++;

      return {
        success: true,
        hasConflicts: false,
        syncTime: this.lastSyncTime
      };
    } catch (error: any) {
      this.stats.failedSyncs++;
      this.lastSyncError = error.message;

      return {
        success: false,
        hasConflicts: false,
        error: error.message
      };
    } finally {
      this.syncing = false;

      // Process queued operations
      await this.processQueue();
    }
  }

  /**
   * Resolve conflicts in the specified files
   * Handles both legacy (todos.json) and directory-based (todos/tasks/{id}/task.json) formats
   */
  async resolveConflicts(conflictedFiles: string[]): Promise<string[]> {
    const resolved: string[] = [];

    for (const file of conflictedFiles) {
      // GitManager.resolveConflict() now handles file type detection
      // and calls the appropriate ConflictResolver method
      await this.gitManager.resolveConflict(file);
      resolved.push(file);
    }

    return resolved;
  }

  /**
   * Queue an operation to run after sync completes
   */
  async queueOperation<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.syncing) {
      return operation();
    }

    return new Promise((resolve, reject) => {
      this.syncQueue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Process queued operations
   */
  private async processQueue(): Promise<void> {
    while (this.syncQueue.length > 0) {
      const operation = this.syncQueue.shift();
      if (operation) {
        await operation();
      }
    }
  }

  /**
   * Check if currently syncing
   */
  isSyncing(): boolean {
    return this.syncing;
  }

  /**
   * Start auto-sync at specified interval
   */
  startAutoSync(intervalMs: number): void {
    this.stopAutoSync();

    this.autoSyncInterval = setInterval(async () => {
      if (!this.syncing) {
        await this.sync();
      }
    }, intervalMs);
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = undefined;
    }
  }

  /**
   * Enable sync after write operations
   */
  enableSyncOnWrite(): void {
    this.syncOnWrite = true;
  }

  /**
   * Disable sync after write operations
   */
  disableSyncOnWrite(): void {
    this.syncOnWrite = false;
  }

  /**
   * Enable debouncing for sync operations
   */
  enableDebounce(ms: number): void {
    this.debounceMs = ms;
  }

  /**
   * Trigger a sync (with optional debounce)
   */
  triggerSync(): void {
    if (this.debounceMs > 0) {
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }

      this.debounceTimeout = setTimeout(() => {
        this.sync();
      }, this.debounceMs);
    } else {
      this.sync();
    }
  }

  /**
   * Create a todo with sync
   */
  async createWithSync(input: CreateTodoInput): Promise<Todo> {
    const todo = await this.todoRepo.create(input);

    if (this.syncOnWrite) {
      await this.gitManager.commit(`Added todo: ${input.text}`);
      await this.gitManager.push();
    }

    return todo;
  }

  /**
   * Update a todo with sync
   */
  async updateWithSync(id: string, updates: UpdateTodoInput): Promise<Todo> {
    const todo = await this.todoRepo.update(id, updates);

    if (this.syncOnWrite) {
      await this.gitManager.commit(`Updated todo: ${id}`);
      await this.gitManager.push();
    }

    return todo;
  }

  /**
   * Delete a todo with sync
   */
  async deleteWithSync(id: string): Promise<void> {
    await this.todoRepo.delete(id);

    if (this.syncOnWrite) {
      await this.gitManager.commit(`Deleted todo: ${id}`);
      await this.gitManager.push();
    }
  }

  /**
   * Check if there are conflicts
   */
  async hasConflicts(): Promise<boolean> {
    const status = await this.gitManager.getStatus();
    return status.conflicted.length > 0;
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): number | undefined {
    return this.lastSyncTime;
  }

  /**
   * Get last sync error
   */
  getLastSyncError(): string | undefined {
    return this.lastSyncError;
  }

  /**
   * Get sync statistics
   */
  getStats(): SyncStats {
    return {
      ...this.stats,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastSyncError
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      conflictsResolved: 0
    };
    this.lastSyncTime = undefined;
    this.lastSyncError = undefined;
  }

  /**
   * Perform initial sync on startup
   */
  async initialSync(): Promise<SyncResult> {
    try {
      // First, ensure the repository is initialized
      await this.todoRepo.initialize();

      // Then perform sync
      return await this.sync();
    } catch (error: any) {
      return {
        success: false,
        hasConflicts: false,
        error: `Initial sync failed: ${error.message}`
      };
    }
  }
}
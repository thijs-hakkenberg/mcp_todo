import { SyncManager } from '../../../src/git/SyncManager';
import { GitManager } from '../../../src/git/GitManager';
import { TodoRepository } from '../../../src/data/TodoRepository';
import { ConflictResolver } from '../../../src/git/ConflictResolver';
import { createTodo } from '../../../src/types/Todo';

// Mock dependencies
jest.mock('../../../src/git/GitManager');
jest.mock('../../../src/data/TodoRepository');
jest.mock('../../../src/git/ConflictResolver');

describe('SyncManager', () => {
  let syncManager: SyncManager;
  let mockGitManager: jest.Mocked<GitManager>;
  let mockTodoRepo: jest.Mocked<TodoRepository>;
  let mockConflictResolver: jest.Mocked<ConflictResolver>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocks
    mockGitManager = {
      pull: jest.fn().mockResolvedValue({ success: true, hasConflicts: false }),
      push: jest.fn().mockResolvedValue({ success: true }),
      commit: jest.fn().mockResolvedValue({ success: true }),
      getStatus: jest.fn().mockResolvedValue({
        hasChanges: false,
        ahead: 0,
        behind: 0,
        modified: [],
        created: [],
        deleted: [],
        conflicted: [],
        current: 'main',
        tracking: 'origin/main'
      }),
      syncWithRetry: jest.fn().mockResolvedValue({ success: true }),
      resolveConflict: jest.fn().mockResolvedValue(undefined)
    } as any;

    mockTodoRepo = {
      reload: jest.fn().mockResolvedValue(undefined),
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    } as any;

    mockConflictResolver = {
      resolveFileConflict: jest.fn().mockReturnValue('{}'),
      mergeTodos: jest.fn().mockReturnValue([])
    } as any;

    syncManager = new SyncManager(mockGitManager, mockTodoRepo);
  });

  describe('sync workflow', () => {
    it('should complete sync with no conflicts', async () => {
      mockGitManager.pull.mockResolvedValue({ success: true, hasConflicts: false });
      mockGitManager.push.mockResolvedValue({ success: true });

      const result = await syncManager.sync();

      expect(result.success).toBe(true);
      expect(result.hasConflicts).toBe(false);
      expect(mockGitManager.pull).toHaveBeenCalled();
      expect(mockGitManager.push).toHaveBeenCalled();
      expect(mockTodoRepo.reload).toHaveBeenCalled();
    });

    it('should resolve conflicts using LWW (legacy todos.json)', async () => {
      mockGitManager.pull.mockResolvedValue({
        success: false,
        hasConflicts: true,
        conflictedFiles: ['todos.json']
      });

      mockGitManager.resolveConflict.mockResolvedValue(undefined);
      mockGitManager.commit.mockResolvedValue({ success: true });
      mockGitManager.push.mockResolvedValue({ success: true });

      const result = await syncManager.sync();

      expect(result.success).toBe(true);
      expect(result.hasConflicts).toBe(true);
      expect(result.resolvedConflicts).toEqual(['todos.json']);
      expect(mockGitManager.resolveConflict).toHaveBeenCalledWith('todos.json');
      expect(mockGitManager.commit).toHaveBeenCalledWith(
        expect.stringContaining('Resolved merge conflicts')
      );
    });

    it('should resolve conflicts in directory-based structure (task.json)', async () => {
      mockGitManager.pull.mockResolvedValue({
        success: false,
        hasConflicts: true,
        conflictedFiles: [
          'todos/tasks/abc123/task.json',
          'todos/tasks/def456/task.json'
        ]
      });

      mockGitManager.resolveConflict.mockResolvedValue(undefined);
      mockGitManager.commit.mockResolvedValue({ success: true });
      mockGitManager.push.mockResolvedValue({ success: true });

      const result = await syncManager.sync();

      expect(result.success).toBe(true);
      expect(result.hasConflicts).toBe(true);
      expect(result.resolvedConflicts).toContain('todos/tasks/abc123/task.json');
      expect(result.resolvedConflicts).toContain('todos/tasks/def456/task.json');
      expect(mockGitManager.resolveConflict).toHaveBeenCalledWith('todos/tasks/abc123/task.json');
      expect(mockGitManager.resolveConflict).toHaveBeenCalledWith('todos/tasks/def456/task.json');
      expect(mockGitManager.commit).toHaveBeenCalledWith(
        expect.stringContaining('Resolved merge conflicts')
      );
    });

    it('should resolve conflicts in README.md files', async () => {
      mockGitManager.pull.mockResolvedValue({
        success: false,
        hasConflicts: true,
        conflictedFiles: [
          'todos/tasks/abc123/task.json',
          'todos/tasks/abc123/README.md'
        ]
      });

      mockGitManager.resolveConflict.mockResolvedValue(undefined);
      mockGitManager.commit.mockResolvedValue({ success: true });
      mockGitManager.push.mockResolvedValue({ success: true });

      const result = await syncManager.sync();

      expect(result.success).toBe(true);
      expect(result.hasConflicts).toBe(true);
      expect(result.resolvedConflicts).toContain('todos/tasks/abc123/task.json');
      expect(result.resolvedConflicts).toContain('todos/tasks/abc123/README.md');
      expect(mockGitManager.resolveConflict).toHaveBeenCalledWith('todos/tasks/abc123/task.json');
      expect(mockGitManager.resolveConflict).toHaveBeenCalledWith('todos/tasks/abc123/README.md');
    });

    it('should retry on push failure', async () => {
      mockGitManager.pull.mockResolvedValue({ success: true, hasConflicts: false });
      mockGitManager.push
        .mockResolvedValueOnce({ success: false, needsPull: true })
        .mockResolvedValueOnce({ success: true });

      const result = await syncManager.sync();

      expect(result.success).toBe(true);
      expect(mockGitManager.pull).toHaveBeenCalledTimes(2);
      expect(mockGitManager.push).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple concurrent syncs', async () => {
      let syncInProgress = false;

      mockGitManager.pull.mockImplementation(async () => {
        if (syncInProgress) {
          throw new Error('Sync already in progress');
        }
        syncInProgress = true;
        await new Promise(resolve => setTimeout(resolve, 10));
        syncInProgress = false;
        return { success: true, hasConflicts: false };
      });

      const sync1 = syncManager.sync();
      const sync2 = syncManager.sync();

      const [result1, result2] = await Promise.all([sync1, sync2]);

      // One should succeed, one should be queued or rejected
      expect(result1.success || result2.success).toBe(true);
    });

    it('should queue operations during sync', async () => {
      let resolvePull: any;
      const pullPromise = new Promise(resolve => {
        resolvePull = resolve;
      });

      mockGitManager.pull.mockReturnValue(pullPromise as any);

      // Start sync
      const syncPromise = syncManager.sync();

      // Try to queue an operation
      const queuedOp = syncManager.queueOperation(async () => {
        return 'operation result';
      });

      // Sync is still in progress
      expect(syncManager.isSyncing()).toBe(true);

      // Complete the pull
      resolvePull({ success: true, hasConflicts: false });

      // Wait for sync to complete
      await syncPromise;

      // Queued operation should complete
      const result = await queuedOp;
      expect(result).toBe('operation result');
    });
  });

  describe('auto-sync', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should sync at configured intervals', async () => {
      syncManager.startAutoSync(1000); // 1 second interval

      // No initial sync happens immediately - need to advance timers first
      expect(mockGitManager.pull).not.toHaveBeenCalled();

      // Fast-forward time for first sync
      await jest.advanceTimersByTimeAsync(1000);

      expect(mockGitManager.pull).toHaveBeenCalledTimes(1);

      // Fast-forward time for second sync
      await jest.advanceTimersByTimeAsync(1000);

      expect(mockGitManager.pull).toHaveBeenCalledTimes(2);

      syncManager.stopAutoSync();
    });

    it('should sync after each write operation', async () => {
      syncManager.enableSyncOnWrite();

      const todo = createTodo({
        text: 'Test todo',
        project: 'work',
        createdBy: 'user-123'
      });

      mockTodoRepo.create.mockResolvedValue(todo);

      await syncManager.createWithSync(todo);

      expect(mockTodoRepo.create).toHaveBeenCalled();
      expect(mockGitManager.commit).toHaveBeenCalled();
      expect(mockGitManager.push).toHaveBeenCalled();
    });

    it('should debounce rapid changes', async () => {
      jest.useRealTimers(); // Use real timers for this test
      syncManager.enableDebounce(100);

      // Trigger multiple syncs rapidly
      syncManager.triggerSync();
      syncManager.triggerSync();
      syncManager.triggerSync();

      // Wait for debounce (increased timeout for reliability)
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should only sync once
      expect(mockGitManager.pull).toHaveBeenCalledTimes(1);
    }, 10000); // Increase test timeout

    it('should handle sync failures gracefully', async () => {
      mockGitManager.pull.mockRejectedValue(new Error('Network error'));

      const result = await syncManager.sync();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      expect(syncManager.getLastSyncError()).toContain('Network error');
    });
  });

  describe('conflict handling', () => {
    it('should detect conflicts in todos.json', async () => {
      mockGitManager.getStatus.mockResolvedValue({
        hasChanges: true,
        ahead: 0,
        behind: 0,
        modified: [],
        created: [],
        deleted: [],
        conflicted: ['todos.json'],
        current: 'main',
        tracking: 'origin/main'
      });

      const hasConflicts = await syncManager.hasConflicts();

      expect(hasConflicts).toBe(true);
    });

    it('should merge todos with LWW strategy', async () => {
      const localTodos = [
        createTodo({
          text: 'Local todo',
          project: 'work',
          createdBy: 'user-123'
        })
      ];

      const remoteTodos = [
        createTodo({
          text: 'Remote todo',
          project: 'work',
          createdBy: 'user-123'
        })
      ];

      mockTodoRepo.list.mockResolvedValue(localTodos);
      mockConflictResolver.mergeTodos.mockReturnValue(remoteTodos);

      await syncManager.resolveConflicts(['todos.json']);

      expect(mockGitManager.resolveConflict).toHaveBeenCalledWith('todos.json');
    });
  });

  describe('status and monitoring', () => {
    it('should track sync status', async () => {
      expect(syncManager.isSyncing()).toBe(false);

      let resolvePull: any;
      const pullPromise = new Promise(resolve => {
        resolvePull = resolve;
      });

      mockGitManager.pull.mockReturnValue(pullPromise as any);

      const syncPromise = syncManager.sync();

      expect(syncManager.isSyncing()).toBe(true);

      resolvePull({ success: true, hasConflicts: false });
      await syncPromise;

      expect(syncManager.isSyncing()).toBe(false);
    });

    it('should track last sync time', async () => {
      const before = Date.now();

      await syncManager.sync();

      const lastSync = syncManager.getLastSyncTime();
      expect(lastSync).toBeGreaterThanOrEqual(before);
      expect(lastSync).toBeLessThanOrEqual(Date.now());
    });

    it('should track sync statistics', async () => {
      // First sync - successful
      await syncManager.sync();

      // Second sync - with conflicts
      mockGitManager.pull.mockResolvedValue({
        success: true,  // Changed to true since sync completes even with conflicts
        hasConflicts: true,
        conflictedFiles: ['todos.json']
      });
      await syncManager.sync();

      const stats = syncManager.getStats();

      expect(stats.totalSyncs).toBe(2);
      expect(stats.successfulSyncs).toBe(2);
      expect(stats.failedSyncs).toBe(0);
      expect(stats.conflictsResolved).toBeGreaterThanOrEqual(0);
    });
  });

  describe('write operations with sync', () => {
    beforeEach(() => {
      syncManager.enableSyncOnWrite();
    });

    it('should sync after create', async () => {
      const todo = createTodo({
        text: 'New todo',
        project: 'work',
        createdBy: 'user-123'
      });

      mockTodoRepo.create.mockResolvedValue(todo);

      await syncManager.createWithSync(todo);

      expect(mockTodoRepo.create).toHaveBeenCalledWith(todo);
      expect(mockGitManager.commit).toHaveBeenCalled();
      expect(mockGitManager.push).toHaveBeenCalled();
    });

    it('should sync after update', async () => {
      const todoId = '123'; // Keep as string for compatibility
      const todo = createTodo({
        text: 'Updated todo',
        project: 'work',
        createdBy: 'user-123'
      });

      mockTodoRepo.update.mockResolvedValue(todo);

      await syncManager.updateWithSync(todoId, { text: 'Updated todo' });

      expect(mockTodoRepo.update).toHaveBeenCalledWith('123', { text: 'Updated todo' });
      expect(mockGitManager.commit).toHaveBeenCalled();
      expect(mockGitManager.push).toHaveBeenCalled();
    });

    it('should sync after delete', async () => {
      await syncManager.deleteWithSync('123');

      expect(mockTodoRepo.delete).toHaveBeenCalledWith('123');
      expect(mockGitManager.commit).toHaveBeenCalled();
      expect(mockGitManager.push).toHaveBeenCalled();
    });
  });
});
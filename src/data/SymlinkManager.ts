import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Todo } from '../types/Todo';

/**
 * Manages symlink-based views for directory-based persistence
 *
 * Creates and maintains symlinks in view directories (by-project, by-status, etc.)
 * that point to the primary task storage in todos/tasks/.
 *
 * Supports cross-platform symlink creation:
 * - Unix/Mac: Uses 'dir' type symlinks
 * - Windows: Uses 'junction' type (doesn't require admin privileges)
 *
 * View structure:
 * ```
 * todos/
 *   tasks/{task-id}/              - Primary storage
 *   by-project/{project}/{id} →   - Symlink views
 *   by-status/{status}/{id} →
 *   by-priority/{priority}/{id} →
 *   by-tag/{tag}/{id} →
 *   by-assignee/{assignee}/{id} →
 * ```
 *
 * @example
 * ```typescript
 * const symlinkManager = new SymlinkManager('/path/to/repo');
 *
 * // Create symlinks for a new task
 * await symlinkManager.updateSymlinks(myTodo);
 *
 * // Update symlinks when task properties change
 * await symlinkManager.updateSymlinksWithOldTask(updatedTodo, oldTodo);
 *
 * // Remove all symlinks for a task
 * await symlinkManager.removeSymlinks(myTodo);
 *
 * // Rebuild all symlinks from scratch
 * await symlinkManager.rebuildAllSymlinks(allTodos);
 * ```
 */
export class SymlinkManager {
  private readonly todosBasePath: string;
  private readonly tasksPath: string;
  private readonly symlinkType: 'dir' | 'junction';

  // View directory names
  private static readonly VIEW_DIRECTORIES = [
    'by-project',
    'by-status',
    'by-priority',
    'by-tag',
    'by-assignee'
  ] as const;

  constructor(repoPath: string) {
    this.todosBasePath = path.join(repoPath, 'todos');
    this.tasksPath = path.join(this.todosBasePath, 'tasks');
    this.symlinkType = this.isWindows() ? 'junction' : 'dir';
  }

  /**
   * Check if running on Windows
   */
  isWindows(): boolean {
    return os.platform() === 'win32';
  }

  /**
   * Update symlinks for a task
   * Creates symlinks in all relevant view directories
   *
   * Symlinks are created in:
   * - by-project/{project}/{id}
   * - by-status/{status}/{id}
   * - by-priority/{priority}/{id}
   * - by-tag/{tag}/{id} (for each tag)
   * - by-assignee/{assignee}/{id} (if assignee exists)
   *
   * @param todo - The todo to create symlinks for
   * @throws {Error} If symlink creation fails (except EEXIST)
   */
  async updateSymlinks(todo: Todo): Promise<void> {
    const targetPath = path.join(this.tasksPath, todo.id);

    // Create symlink in by-project/{project}/
    await this.createSymlink(
      targetPath,
      path.join(this.todosBasePath, 'by-project', todo.project, todo.id)
    );

    // Create symlink in by-status/{status}/
    await this.createSymlink(
      targetPath,
      path.join(this.todosBasePath, 'by-status', todo.status, todo.id)
    );

    // Create symlink in by-priority/{priority}/
    await this.createSymlink(
      targetPath,
      path.join(this.todosBasePath, 'by-priority', todo.priority, todo.id)
    );

    // Create symlinks for each tag in by-tag/{tag}/
    if (todo.tags && todo.tags.length > 0) {
      for (const tag of todo.tags) {
        await this.createSymlink(
          targetPath,
          path.join(this.todosBasePath, 'by-tag', tag, todo.id)
        );
      }
    }

    // Create symlink in by-assignee/{assignee}/ if assignee exists
    if (todo.assignee) {
      await this.createSymlink(
        targetPath,
        path.join(this.todosBasePath, 'by-assignee', todo.assignee, todo.id)
      );
    }
  }

  /**
   * Update symlinks when task properties change
   * Removes old symlinks that are no longer valid and creates new ones
   *
   * Intelligently handles property changes by only touching affected symlinks:
   * - Only updates symlinks for properties that changed
   * - Removes symlinks for old values (e.g., old project, old status)
   * - Creates symlinks for new values
   * - Handles tag additions/removals independently
   *
   * @param newTodo - The updated todo
   * @param oldTodo - The previous version of the todo
   * @throws {Error} If symlink operations fail
   */
  async updateSymlinksWithOldTask(newTodo: Todo, oldTodo: Todo): Promise<void> {
    const targetPath = path.join(this.tasksPath, newTodo.id);

    // Handle project change
    if (newTodo.project !== oldTodo.project) {
      await this.removeSymlink(
        path.join(this.todosBasePath, 'by-project', oldTodo.project, oldTodo.id)
      );
      await this.createSymlink(
        targetPath,
        path.join(this.todosBasePath, 'by-project', newTodo.project, newTodo.id)
      );
    }

    // Handle status change
    if (newTodo.status !== oldTodo.status) {
      await this.removeSymlink(
        path.join(this.todosBasePath, 'by-status', oldTodo.status, oldTodo.id)
      );
      await this.createSymlink(
        targetPath,
        path.join(this.todosBasePath, 'by-status', newTodo.status, newTodo.id)
      );
    }

    // Handle priority change
    if (newTodo.priority !== oldTodo.priority) {
      await this.removeSymlink(
        path.join(this.todosBasePath, 'by-priority', oldTodo.priority, oldTodo.id)
      );
      await this.createSymlink(
        targetPath,
        path.join(this.todosBasePath, 'by-priority', newTodo.priority, newTodo.id)
      );
    }

    // Handle tag changes
    const oldTags = oldTodo.tags || [];
    const newTags = newTodo.tags || [];
    const removedTags = oldTags.filter(tag => !newTags.includes(tag));
    const addedTags = newTags.filter(tag => !oldTags.includes(tag));

    for (const tag of removedTags) {
      await this.removeSymlink(
        path.join(this.todosBasePath, 'by-tag', tag, oldTodo.id)
      );
    }

    for (const tag of addedTags) {
      await this.createSymlink(
        targetPath,
        path.join(this.todosBasePath, 'by-tag', tag, newTodo.id)
      );
    }

    // Handle assignee change
    if (newTodo.assignee !== oldTodo.assignee) {
      if (oldTodo.assignee) {
        await this.removeSymlink(
          path.join(this.todosBasePath, 'by-assignee', oldTodo.assignee, oldTodo.id)
        );
      }
      if (newTodo.assignee) {
        await this.createSymlink(
          targetPath,
          path.join(this.todosBasePath, 'by-assignee', newTodo.assignee, newTodo.id)
        );
      }
    }
  }

  /**
   * Remove all symlinks for a task
   *
   * Removes symlinks from all view directories where this task appears.
   * Gracefully handles missing symlinks (ENOENT errors).
   *
   * This should be called when:
   * - A task is deleted
   * - Before rebuilding symlinks
   *
   * @param todo - The todo to remove symlinks for
   * @throws {Error} If removal fails (except ENOENT)
   */
  async removeSymlinks(todo: Todo): Promise<void> {
    // Remove symlink from by-project
    await this.removeSymlink(
      path.join(this.todosBasePath, 'by-project', todo.project, todo.id)
    );

    // Remove symlink from by-status
    await this.removeSymlink(
      path.join(this.todosBasePath, 'by-status', todo.status, todo.id)
    );

    // Remove symlink from by-priority
    await this.removeSymlink(
      path.join(this.todosBasePath, 'by-priority', todo.priority, todo.id)
    );

    // Remove symlinks from by-tag
    if (todo.tags && todo.tags.length > 0) {
      for (const tag of todo.tags) {
        await this.removeSymlink(
          path.join(this.todosBasePath, 'by-tag', tag, todo.id)
        );
      }
    }

    // Remove symlink from by-assignee if exists
    if (todo.assignee) {
      await this.removeSymlink(
        path.join(this.todosBasePath, 'by-assignee', todo.assignee, todo.id)
      );
    }
  }

  /**
   * Rebuild all symlinks from scratch
   * Clears all view directories and recreates symlinks for all tasks
   *
   * This is useful for:
   * - Recovering from symlink corruption
   * - Migrating from legacy persistence format
   * - Repairing inconsistent state after manual edits
   *
   * @param todos - Array of all todos to recreate symlinks for
   * @throws {Error} If file system operations fail
   */
  async rebuildAllSymlinks(todos: Todo[]): Promise<void> {
    // Clear all view directories
    for (const viewDir of SymlinkManager.VIEW_DIRECTORIES) {
      const dirPath = path.join(this.todosBasePath, viewDir);
      await fs.rm(dirPath, { recursive: true, force: true });
    }

    // Recreate symlinks for all tasks
    for (const todo of todos) {
      await this.updateSymlinks(todo);
    }
  }

  /**
   * Create a symlink with parent directory creation
   * Handles EEXIST errors gracefully
   */
  private async createSymlink(target: string, linkPath: string): Promise<void> {
    try {
      // Ensure parent directory exists
      const parentDir = path.dirname(linkPath);
      await fs.mkdir(parentDir, { recursive: true });

      // Create symlink
      await fs.symlink(target, linkPath, this.symlinkType);
    } catch (error: any) {
      // Ignore if symlink already exists
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Remove a symlink
   * Handles ENOENT errors gracefully
   */
  private async removeSymlink(linkPath: string): Promise<void> {
    try {
      await fs.unlink(linkPath);
    } catch (error: any) {
      // Ignore if symlink doesn't exist
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConflictResolver } from './ConflictResolver';
import { uuidv7 } from 'uuidv7';

export interface GitOperationResult {
  success: boolean;
  error?: string;
  hasConflicts?: boolean;
  conflictedFiles?: string[];
  needsPull?: boolean;
}

export interface GitStatus {
  hasChanges: boolean;
  ahead: number;
  behind: number;
  modified: string[];
  created: string[];
  deleted: string[];
  conflicted: string[];
  current: string | null;
  tracking: string | null;
}

/**
 * Manages Git operations for the todo repository
 */
export class GitManager {
  private git: SimpleGit;
  private repoPath: string;
  private conflictResolver: ConflictResolver;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
    this.conflictResolver = new ConflictResolver();
  }

  /**
   * Initialize the git repository
   */
  async initialize(remoteUrl?: string): Promise<void> {
    try {
      // Check if already a git repo
      const isRepo = await this.git.checkIsRepo();

      if (!isRepo) {
        await this.git.init();
      }

      // Add remote if provided and doesn't exist
      if (remoteUrl) {
        const remotes = await this.git.getRemotes();
        const hasOrigin = remotes.some(r => r.name === 'origin');

        if (!hasOrigin) {
          await this.git.addRemote('origin', remoteUrl);
        }
      }
    } catch (error) {
      console.error('Failed to initialize git repository:', error);
      throw error;
    }
  }

  /**
   * Pull changes from remote
   */
  async pull(): Promise<GitOperationResult> {
    try {
      await this.git.pull();

      return {
        success: true,
        hasConflicts: false
      };
    } catch (error: any) {
      // Check if it's a merge conflict
      const status = await this.git.status();

      if (status.conflicted.length > 0) {
        return {
          success: false,
          hasConflicts: true,
          conflictedFiles: status.conflicted,
          error: 'Merge conflict detected'
        };
      }

      // Check if it's a network error
      if (error.message?.includes('Network') || error.message?.includes('unable to access')) {
        return {
          success: false,
          error: `Network error: ${error.message}`
        };
      }

      // Retry logic for temporary failures
      if (error.message?.includes('Temporary failure')) {
        // This will be handled by the retry wrapper
        throw error;
      }

      return {
        success: false,
        error: error.message || 'Pull failed'
      };
    }
  }

  /**
   * Push changes to remote
   */
  async push(): Promise<GitOperationResult> {
    try {
      await this.git.push();

      return {
        success: true
      };
    } catch (error: any) {
      // Check if it's a non-fast-forward error
      if (error.message?.includes('non-fast-forward')) {
        return {
          success: false,
          needsPull: true,
          error: 'Remote has newer changes, pull required'
        };
      }

      return {
        success: false,
        error: error.message || 'Push failed'
      };
    }
  }

  /**
   * Commit changes with a message
   */
  async commit(message: string): Promise<GitOperationResult> {
    try {
      await this.git.add('.');
      await this.git.commit(message);

      return {
        success: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Commit failed'
      };
    }
  }

  /**
   * Get repository status
   */
  async getStatus(): Promise<GitStatus> {
    const status = await this.git.status();

    return {
      hasChanges: status.files.length > 0,
      ahead: status.ahead,
      behind: status.behind,
      modified: status.modified,
      created: status.created,
      deleted: status.deleted,
      conflicted: status.conflicted,
      current: status.current,
      tracking: status.tracking
    };
  }

  /**
   * Sync with remote (pull, merge, push) with retry logic
   */
  async syncWithRetry(maxRetries: number = 3): Promise<GitOperationResult> {
    let attempts = 0;

    while (attempts <= maxRetries) {
      // Try to push
      const pushResult = await this.push();

      if (pushResult.success) {
        return pushResult;
      }

      if (pushResult.needsPull) {
        // Pull and try again
        const pullResult = await this.pull();

        if (!pullResult.success) {
          if (pullResult.hasConflicts) {
            // Handle conflicts
            for (const file of pullResult.conflictedFiles || []) {
              await this.resolveConflict(file);
            }

            // Commit the resolution
            await this.commit('Resolved merge conflicts');
          } else {
            return pullResult;
          }
        }

        attempts++;
      } else {
        // Some other error
        return pushResult;
      }
    }

    return {
      success: false,
      error: `Failed after ${maxRetries} retries`
    };
  }

  /**
   * Write file atomically (write to temp, then rename)
   */
  async writeFileAtomic(filePath: string, content: string): Promise<void> {
    const tempPath = `${filePath}.tmp.${uuidv7()}`;

    try {
      // Write to temp file
      await fs.writeFile(tempPath, content, 'utf-8');

      // Atomically rename
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }

      throw error;
    }
  }

  /**
   * Resolve a conflict in a file
   * Automatically detects file type and uses appropriate resolution strategy:
   * - task.json files: Uses resolveTaskFileConflict() for per-task LWW merge
   * - README.md files: Uses resolveReadmeConflict() with timestamp-based selection
   * - todos.json (legacy): Uses resolveFileConflict() for backward compatibility
   */
  async resolveConflict(filePath: string): Promise<void> {
    const fullPath = path.join(this.repoPath, filePath);

    try {
      // For now, just read the local version
      // In a real implementation, we'd parse the conflict markers
      const localContent = await fs.readFile(fullPath, 'utf-8');

      // This is a simplified version - in reality we'd need to extract
      // the local and remote versions from the conflict markers
      const remoteContent = localContent; // Placeholder

      let resolvedContent: string;

      // Detect file type and use appropriate resolution strategy
      if (filePath.endsWith('/task.json')) {
        // Directory-based: individual task file
        resolvedContent = this.conflictResolver.resolveTaskFileConflict(
          localContent,
          remoteContent
        );
      } else if (filePath.endsWith('/README.md')) {
        // Directory-based: README.md file (description)
        // Extract timestamps from task.json in the same directory
        const taskJsonPath = filePath.replace('/README.md', '/task.json');
        const taskJsonFullPath = path.join(this.repoPath, taskJsonPath);

        try {
          const taskContent = await fs.readFile(taskJsonFullPath, 'utf-8');
          const task = JSON.parse(taskContent);
          const localModifiedAt = task.modifiedAt;
          const remoteModifiedAt = task.modifiedAt; // In reality, would parse remote version

          resolvedContent = this.conflictResolver.resolveReadmeConflict(
            localContent,
            remoteContent,
            localModifiedAt,
            remoteModifiedAt
          );
        } catch {
          // If we can't read task.json, fall back to preferring remote
          resolvedContent = this.conflictResolver.resolveReadmeConflict(
            localContent,
            remoteContent,
            undefined,
            new Date().toISOString()
          );
        }
      } else if (filePath === 'todos.json') {
        // Legacy monolithic format
        resolvedContent = this.conflictResolver.resolveFileConflict(
          localContent,
          remoteContent
        );
      } else {
        // Unknown file type - use legacy method as fallback
        resolvedContent = this.conflictResolver.resolveFileConflict(
          localContent,
          remoteContent
        );
      }

      await this.writeFileAtomic(fullPath, resolvedContent);
    } catch (error) {
      console.error(`Failed to resolve conflict in ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string | null> {
    const branchInfo = await this.git.branch();
    return branchInfo.current;
  }

  /**
   * Checkout a branch
   */
  async checkout(branch: string): Promise<void> {
    await this.git.checkout(branch);
  }

  /**
   * Pull with retry logic
   */
  async pullWithRetry(maxRetries: number = 3): Promise<GitOperationResult> {
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < maxRetries) {
      try {
        const result = await this.pull();

        if (result.success || result.hasConflicts) {
          return result;
        }

        // If it's a temporary failure, retry
        if (result.error?.includes('Temporary failure')) {
          attempts++;
          lastError = new Error(result.error);

          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
          continue;
        }

        return result;
      } catch (error: any) {
        if (error.message?.includes('Temporary failure')) {
          attempts++;
          lastError = error;

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
          continue;
        }

        throw error;
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Pull failed after retries'
    };
  }
}
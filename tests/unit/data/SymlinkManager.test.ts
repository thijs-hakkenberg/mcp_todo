import { SymlinkManager } from '../../../src/data/SymlinkManager';
import { Todo, createTodo } from '../../../src/types/Todo';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('os');

describe('SymlinkManager', () => {
  let symlinkManager: SymlinkManager;
  const testRepoPath = '/test/repo/path';
  const todosBasePath = path.join(testRepoPath, 'todos');
  const tasksPath = path.join(todosBasePath, 'tasks');

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock fs functions
    (fs.symlink as jest.Mock).mockResolvedValue(undefined);
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue([]);
    (fs.rm as jest.Mock).mockResolvedValue(undefined);
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.lstat as jest.Mock).mockResolvedValue({ isSymbolicLink: () => true } as any);

    // Mock os.platform() - default to Unix
    (os.platform as jest.Mock).mockReturnValue('linux');

    symlinkManager = new SymlinkManager(testRepoPath);
  });

  describe('updateSymlinks', () => {
    const testTask: Todo = createTodo({
      id: '019a1234-5678-7000-8000-abcdef123456',
      text: 'Test task',
      project: 'test-project',
      status: 'todo',
      priority: 'high',
      tags: ['bug', 'urgent'],
      assignee: 'test-user',
      createdBy: 'test-user'
    });

    it('should create symlink in by-project/{project}/', async () => {
      await symlinkManager.updateSymlinks(testTask);

      const targetPath = path.join(tasksPath, testTask.id);
      const linkPath = path.join(todosBasePath, 'by-project', 'test-project', testTask.id);

      expect(fs.symlink).toHaveBeenCalledWith(
        targetPath,
        linkPath,
        'dir'
      );
    });

    it('should create symlink in by-status/{status}/', async () => {
      await symlinkManager.updateSymlinks(testTask);

      const targetPath = path.join(tasksPath, testTask.id);
      const linkPath = path.join(todosBasePath, 'by-status', 'todo', testTask.id);

      expect(fs.symlink).toHaveBeenCalledWith(
        targetPath,
        linkPath,
        'dir'
      );
    });

    it('should create symlink in by-priority/{priority}/', async () => {
      await symlinkManager.updateSymlinks(testTask);

      const targetPath = path.join(tasksPath, testTask.id);
      const linkPath = path.join(todosBasePath, 'by-priority', 'high', testTask.id);

      expect(fs.symlink).toHaveBeenCalledWith(
        targetPath,
        linkPath,
        'dir'
      );
    });

    it('should create symlinks for all tags in by-tag/', async () => {
      await symlinkManager.updateSymlinks(testTask);

      const targetPath = path.join(tasksPath, testTask.id);

      expect(fs.symlink).toHaveBeenCalledWith(
        targetPath,
        path.join(todosBasePath, 'by-tag', 'bug', testTask.id),
        'dir'
      );
      expect(fs.symlink).toHaveBeenCalledWith(
        targetPath,
        path.join(todosBasePath, 'by-tag', 'urgent', testTask.id),
        'dir'
      );
    });

    it('should create symlink in by-assignee/{assignee}/', async () => {
      await symlinkManager.updateSymlinks(testTask);

      const targetPath = path.join(tasksPath, testTask.id);
      const linkPath = path.join(todosBasePath, 'by-assignee', 'test-user', testTask.id);

      expect(fs.symlink).toHaveBeenCalledWith(
        targetPath,
        linkPath,
        'dir'
      );
    });

    it('should handle task without assignee', async () => {
      const taskWithoutAssignee = { ...testTask, assignee: undefined };

      await symlinkManager.updateSymlinks(taskWithoutAssignee);

      // Should not create assignee symlink
      const assigneeLinkPath = path.join(todosBasePath, 'by-assignee');
      const symlinkCalls = (fs.symlink as jest.Mock).mock.calls.map(call => call[1]);
      const hasAssigneeLink = symlinkCalls.some(linkPath => linkPath.includes(assigneeLinkPath));

      expect(hasAssigneeLink).toBe(false);
    });

    it('should handle task with empty tags array', async () => {
      const taskWithoutTags = { ...testTask, tags: [] };

      await symlinkManager.updateSymlinks(taskWithoutTags);

      // Should not create any tag symlinks
      const tagLinkPath = path.join(todosBasePath, 'by-tag');
      const symlinkCalls = (fs.symlink as jest.Mock).mock.calls.map(call => call[1]);
      const hasTagLink = symlinkCalls.some(linkPath => linkPath.includes(tagLinkPath));

      expect(hasTagLink).toBe(false);
    });

    it('should handle symlink already exists', async () => {
      (fs.symlink as jest.Mock).mockRejectedValue({ code: 'EEXIST' });

      await expect(symlinkManager.updateSymlinks(testTask)).resolves.not.toThrow();
    });

    it('should create parent directories if they do not exist', async () => {
      await symlinkManager.updateSymlinks(testTask);

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-project', 'test-project'),
        { recursive: true }
      );
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-status', 'todo'),
        { recursive: true }
      );
    });

    it('should handle spaces in project names', async () => {
      const taskWithSpaces = { ...testTask, project: 'My Project Name' };

      await symlinkManager.updateSymlinks(taskWithSpaces);

      const linkPath = path.join(todosBasePath, 'by-project', 'My Project Name', testTask.id);
      expect(fs.symlink).toHaveBeenCalledWith(
        expect.any(String),
        linkPath,
        'dir'
      );
    });

    it('should handle special characters in tag names', async () => {
      const taskWithSpecialTags = { ...testTask, tags: ['bug-fix', 'v1.0', 'high/priority'] };

      await symlinkManager.updateSymlinks(taskWithSpecialTags);

      // Should create symlinks for all tags (sanitized if needed)
      expect(fs.symlink).toHaveBeenCalled();
    });
  });

  describe('updateSymlinksWithOldTask', () => {
    const oldTask: Todo = createTodo({
      id: '019a1234-5678-7000-8000-abcdef123456',
      text: 'Test task',
      project: 'old-project',
      status: 'todo',
      priority: 'low',
      tags: ['old-tag'],
      assignee: 'old-user',
      createdBy: 'test-user'
    });

    const newTask: Todo = {
      ...oldTask,
      project: 'new-project',
      status: 'done',
      priority: 'high',
      tags: ['new-tag'],
      assignee: 'new-user'
    };

    it('should remove old symlinks when task properties change', async () => {
      await symlinkManager.updateSymlinksWithOldTask(newTask, oldTask);

      // Should remove old project symlink
      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-project', 'old-project', oldTask.id)
      );

      // Should remove old status symlink
      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-status', 'todo', oldTask.id)
      );
    });

    it('should create new symlinks for updated task', async () => {
      await symlinkManager.updateSymlinksWithOldTask(newTask, oldTask);

      const targetPath = path.join(tasksPath, newTask.id);

      // Should create new project symlink
      expect(fs.symlink).toHaveBeenCalledWith(
        targetPath,
        path.join(todosBasePath, 'by-project', 'new-project', newTask.id),
        'dir'
      );

      // Should create new status symlink
      expect(fs.symlink).toHaveBeenCalledWith(
        targetPath,
        path.join(todosBasePath, 'by-status', 'done', newTask.id),
        'dir'
      );
    });

    it('should not remove/recreate unchanged symlinks', async () => {
      const unchangedTask = { ...oldTask, text: 'Updated text' };

      await symlinkManager.updateSymlinksWithOldTask(unchangedTask, oldTask);

      // Should not touch project symlink (unchanged)
      const projectUnlinkCalls = (fs.unlink as jest.Mock).mock.calls.filter(call =>
        call[0].includes('by-project')
      );
      expect(projectUnlinkCalls.length).toBe(0);
    });

    it('should handle tag changes correctly', async () => {
      await symlinkManager.updateSymlinksWithOldTask(newTask, oldTask);

      // Should remove old tag symlink
      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-tag', 'old-tag', oldTask.id)
      );

      // Should create new tag symlink
      expect(fs.symlink).toHaveBeenCalledWith(
        expect.any(String),
        path.join(todosBasePath, 'by-tag', 'new-tag', newTask.id),
        'dir'
      );
    });

    it('should handle assignee changes correctly', async () => {
      await symlinkManager.updateSymlinksWithOldTask(newTask, oldTask);

      // Should remove old assignee symlink
      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-assignee', 'old-user', oldTask.id)
      );

      // Should create new assignee symlink
      expect(fs.symlink).toHaveBeenCalledWith(
        expect.any(String),
        path.join(todosBasePath, 'by-assignee', 'new-user', newTask.id),
        'dir'
      );
    });
  });

  describe('removeSymlinks', () => {
    const testTask: Todo = createTodo({
      id: '019a1234-5678-7000-8000-abcdef123456',
      text: 'Test task',
      project: 'test-project',
      status: 'todo',
      priority: 'high',
      tags: ['bug', 'urgent'],
      assignee: 'test-user',
      createdBy: 'test-user'
    });

    it('should remove all symlinks for a task', async () => {
      await symlinkManager.removeSymlinks(testTask);

      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-project', 'test-project', testTask.id)
      );
      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-status', 'todo', testTask.id)
      );
      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-priority', 'high', testTask.id)
      );
      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-tag', 'bug', testTask.id)
      );
      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-assignee', 'test-user', testTask.id)
      );
    });

    it('should handle missing symlinks gracefully', async () => {
      (fs.unlink as jest.Mock).mockRejectedValue({ code: 'ENOENT' });

      await expect(symlinkManager.removeSymlinks(testTask)).resolves.not.toThrow();
    });

    it('should handle task without assignee', async () => {
      const taskWithoutAssignee = { ...testTask, assignee: undefined };

      await symlinkManager.removeSymlinks(taskWithoutAssignee);

      // Should still succeed even if no assignee symlink
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should handle task with no tags', async () => {
      const taskWithoutTags = { ...testTask, tags: [] };

      await symlinkManager.removeSymlinks(taskWithoutTags);

      // Should still succeed even if no tag symlinks
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('rebuildAllSymlinks', () => {
    const task1: Todo = createTodo({
      id: '019a1234-5678-7000-8000-000000000001',
      text: 'Task 1',
      project: 'project-a',
      status: 'todo',
      priority: 'high',
      tags: ['bug'],
      createdBy: 'user-1'
    });

    const task2: Todo = createTodo({
      id: '019a1234-5678-7000-8000-000000000002',
      text: 'Task 2',
      project: 'project-b',
      status: 'done',
      priority: 'low',
      tags: ['feature'],
      assignee: 'user-2',
      createdBy: 'user-2'
    });

    it('should clear all view directories', async () => {
      await symlinkManager.rebuildAllSymlinks([task1, task2]);

      expect(fs.rm).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-project'),
        { recursive: true, force: true }
      );
      expect(fs.rm).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-status'),
        { recursive: true, force: true }
      );
      expect(fs.rm).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-priority'),
        { recursive: true, force: true }
      );
      expect(fs.rm).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-tag'),
        { recursive: true, force: true }
      );
      expect(fs.rm).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-assignee'),
        { recursive: true, force: true }
      );
    });

    it('should recreate symlinks for all tasks', async () => {
      await symlinkManager.rebuildAllSymlinks([task1, task2]);

      // Should create symlinks for task1
      expect(fs.symlink).toHaveBeenCalledWith(
        expect.stringContaining(task1.id),
        expect.stringContaining('project-a'),
        'dir'
      );

      // Should create symlinks for task2
      expect(fs.symlink).toHaveBeenCalledWith(
        expect.stringContaining(task2.id),
        expect.stringContaining('project-b'),
        'dir'
      );
    });

    it('should handle empty task list', async () => {
      await symlinkManager.rebuildAllSymlinks([]);

      expect(fs.rm).toHaveBeenCalled();
      expect(fs.symlink).not.toHaveBeenCalled();
    });

    it('should recreate view directories after clearing', async () => {
      await symlinkManager.rebuildAllSymlinks([task1]);

      // After rm, should recreate directories via mkdir
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('by-project'),
        { recursive: true }
      );
    });
  });

  describe('cross-platform compatibility', () => {
    const testTask: Todo = createTodo({
      id: '019a1234-5678-7000-8000-abcdef123456',
      text: 'Test task',
      project: 'test-project',
      createdBy: 'test-user'
    });

    it('should create symlinks on Unix/Mac', async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');

      await symlinkManager.updateSymlinks(testTask);

      expect(fs.symlink).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'dir'
      );
    });

    it('should use junction on Windows', async () => {
      (os.platform as jest.Mock).mockReturnValue('win32');
      symlinkManager = new SymlinkManager(testRepoPath); // Recreate to pick up platform

      await symlinkManager.updateSymlinks(testTask);

      expect(fs.symlink).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'junction'
      );
    });

    it('should detect symlink support', () => {
      const isWindows = symlinkManager.isWindows();
      expect(typeof isWindows).toBe('boolean');
    });
  });

  describe('error handling', () => {
    const testTask: Todo = createTodo({
      id: '019a1234-5678-7000-8000-abcdef123456',
      text: 'Test task',
      project: 'test-project',
      createdBy: 'test-user'
    });

    it('should handle permission errors when creating symlinks', async () => {
      (fs.symlink as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      await expect(symlinkManager.updateSymlinks(testTask)).rejects.toThrow('Permission denied');
    });

    it('should handle permission errors when removing symlinks', async () => {
      (fs.unlink as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      await expect(symlinkManager.removeSymlinks(testTask)).rejects.toThrow('Permission denied');
    });

    it('should handle broken symlinks during rebuild', async () => {
      (fs.lstat as jest.Mock).mockResolvedValue({ isSymbolicLink: () => true } as any);
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await expect(symlinkManager.rebuildAllSymlinks([testTask])).resolves.not.toThrow();
    });
  });
});

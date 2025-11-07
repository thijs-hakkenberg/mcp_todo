import { DirectoryManager } from '../../../src/data/DirectoryManager';
import { GitManager } from '../../../src/git/GitManager';
import { Todo, createTodo } from '../../../src/types/Todo';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
jest.mock('fs/promises');

describe('DirectoryManager', () => {
  let dirManager: DirectoryManager;
  let mockGitManager: jest.Mocked<GitManager>;
  const testRepoPath = '/test/repo/path';
  const todosBasePath = path.join(testRepoPath, 'todos');
  const tasksPath = path.join(todosBasePath, 'tasks');

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock GitManager
    mockGitManager = {
      writeFileAtomic: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue({ success: true }),
      syncWithRetry: jest.fn().mockResolvedValue({ success: true })
    } as any;

    // Mock fs functions
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as jest.Mock).mockResolvedValue('{}');
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue([]);
    (fs.stat as jest.Mock).mockResolvedValue({ isDirectory: () => true } as any);
    (fs.rm as jest.Mock).mockResolvedValue(undefined);

    dirManager = new DirectoryManager(testRepoPath, mockGitManager);
  });

  describe('ensureDirectoryStructure', () => {
    it('should create todos/tasks directory', async () => {
      await dirManager.ensureDirectoryStructure();

      expect(fs.mkdir).toHaveBeenCalledWith(
        tasksPath,
        { recursive: true }
      );
    });

    it('should create view directories (by-project, by-status, by-priority, by-tag, by-assignee)', async () => {
      await dirManager.ensureDirectoryStructure();

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-project'),
        { recursive: true }
      );
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-status'),
        { recursive: true }
      );
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-priority'),
        { recursive: true }
      );
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-tag'),
        { recursive: true }
      );
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(todosBasePath, 'by-assignee'),
        { recursive: true }
      );
    });

    it('should not error if directories already exist', async () => {
      (fs.mkdir as jest.Mock).mockRejectedValue({ code: 'EEXIST' });

      await expect(dirManager.ensureDirectoryStructure()).resolves.not.toThrow();
    });

    it('should throw on other errors', async () => {
      (fs.mkdir as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      await expect(dirManager.ensureDirectoryStructure()).rejects.toThrow('Permission denied');
    });
  });

  describe('getTaskPath', () => {
    it('should return correct path for task ID', () => {
      const taskId = '019a1234-5678-7000-8000-abcdef123456';
      const expectedPath = path.join(tasksPath, taskId);

      const result = dirManager.getTaskPath(taskId);

      expect(result).toBe(expectedPath);
    });

    it('should throw for empty task ID', () => {
      expect(() => dirManager.getTaskPath('')).toThrow('Task ID cannot be empty');
    });

    it('should throw for null/undefined task ID', () => {
      expect(() => dirManager.getTaskPath(null as any)).toThrow();
      expect(() => dirManager.getTaskPath(undefined as any)).toThrow();
    });

    it('should handle task IDs with special characters', () => {
      const taskId = '019a1234-5678-7000-8000-abcdef123456';
      const result = dirManager.getTaskPath(taskId);

      expect(result).toContain(taskId);
    });
  });

  describe('readTask', () => {
    const testTaskId = '019a1234-5678-7000-8000-abcdef123456';
    const testTask: Todo = createTodo({
      id: testTaskId,
      text: 'Test task',
      project: 'test-project',
      createdBy: 'test-user'
    });

    it('should read task.json and parse to Todo object', async () => {
      const taskJson = JSON.stringify(testTask);
      (fs.readFile as jest.Mock).mockResolvedValue(taskJson);

      const result = await dirManager.readTask(testTaskId);

      expect(result).toMatchObject({
        id: testTaskId,
        text: 'Test task',
        project: 'test-project'
      });
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(tasksPath, testTaskId, 'task.json'),
        'utf-8'
      );
    });

    it('should merge README.md content into description if present', async () => {
      const taskJson = JSON.stringify({ ...testTask, description: 'Short desc' });
      const readmeContent = '# Detailed Description\n\nThis is a longer description.';

      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce(taskJson) // task.json
        .mockResolvedValueOnce(readmeContent); // README.md
      (fs.access as jest.Mock).mockResolvedValue(undefined); // README.md exists

      const result = await dirManager.readTask(testTaskId);

      expect(result.description).toContain('Detailed Description');
    });

    it('should handle missing task directory', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue({ code: 'ENOENT' });

      await expect(dirManager.readTask(testTaskId)).rejects.toThrow('not found');
    });

    it('should handle corrupted JSON', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('{ invalid json }');

      await expect(dirManager.readTask(testTaskId)).rejects.toThrow();
    });

    it('should handle task.json with missing required fields', async () => {
      const invalidTask = { id: testTaskId }; // Missing required fields
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(invalidTask));

      await expect(dirManager.readTask(testTaskId)).rejects.toThrow();
    });

    it('should handle README.md not existing (should not error)', async () => {
      const taskJson = JSON.stringify(testTask);
      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce(taskJson)
        .mockRejectedValueOnce({ code: 'ENOENT' }); // README.md doesn't exist

      const result = await dirManager.readTask(testTaskId);

      expect(result).toBeDefined();
      expect(result.id).toBe(testTaskId);
    });
  });

  describe('writeTask', () => {
    const testTask: Todo = createTodo({
      id: '019a1234-5678-7000-8000-abcdef123456',
      text: 'Test task',
      project: 'test-project',
      createdBy: 'test-user'
    });

    it('should write task.json atomically', async () => {
      await dirManager.writeTask(testTask);

      expect(mockGitManager.writeFileAtomic).toHaveBeenCalledWith(
        path.join(tasksPath, testTask.id, 'task.json'),
        expect.any(String)
      );
    });

    it('should create task directory if not exists', async () => {
      await dirManager.writeTask(testTask);

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(tasksPath, testTask.id),
        { recursive: true }
      );
    });

    it('should preserve artifacts directory if it exists', async () => {
      const artifactsPath = path.join(tasksPath, testTask.id, 'artifacts');
      (fs.access as jest.Mock).mockResolvedValue(undefined); // artifacts exists

      await dirManager.writeTask(testTask);

      expect(fs.rm).not.toHaveBeenCalledWith(artifactsPath);
    });

    it('should extract rich content to README.md if description > threshold', async () => {
      const longDescription = 'A'.repeat(500); // > 300 char threshold
      const taskWithLongDesc = { ...testTask, description: longDescription };

      await dirManager.writeTask(taskWithLongDesc);

      expect(mockGitManager.writeFileAtomic).toHaveBeenCalledWith(
        path.join(tasksPath, testTask.id, 'README.md'),
        longDescription
      );
    });

    it('should not create README.md for short descriptions', async () => {
      const shortDescription = 'Short description';
      const taskWithShortDesc = { ...testTask, description: shortDescription };

      await dirManager.writeTask(taskWithShortDesc);

      expect(mockGitManager.writeFileAtomic).not.toHaveBeenCalledWith(
        expect.stringContaining('README.md'),
        expect.any(String)
      );
    });

    it('should validate task has required fields', async () => {
      const invalidTask = { id: testTask.id } as any; // Missing required fields

      await expect(dirManager.writeTask(invalidTask)).rejects.toThrow();
    });

    it('should handle write errors gracefully', async () => {
      mockGitManager.writeFileAtomic.mockRejectedValue(new Error('Disk full'));

      await expect(dirManager.writeTask(testTask)).rejects.toThrow('Disk full');
    });
  });

  describe('deleteTask', () => {
    const testTaskId = '019a1234-5678-7000-8000-abcdef123456';

    it('should remove task directory recursively', async () => {
      await dirManager.deleteTask(testTaskId);

      expect(fs.rm).toHaveBeenCalledWith(
        path.join(tasksPath, testTaskId),
        { recursive: true, force: true }
      );
    });

    it('should handle non-existent directory gracefully', async () => {
      (fs.rm as jest.Mock).mockRejectedValue({ code: 'ENOENT' });

      await expect(dirManager.deleteTask(testTaskId)).resolves.not.toThrow();
    });

    it('should preserve artifacts if preserveArtifacts option is true', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined); // artifacts exists
      (fs.readdir as jest.Mock).mockResolvedValue(['image.png']);

      await dirManager.deleteTask(testTaskId, { preserveArtifacts: true });

      // Should have moved artifacts to a backup location
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('artifacts-backup'),
        expect.any(Object)
      );
    });

    it('should throw for empty task ID', async () => {
      await expect(dirManager.deleteTask('')).rejects.toThrow('Task ID cannot be empty');
    });
  });

  describe('listAllTasks', () => {
    it('should scan todos/tasks and return all task IDs', async () => {
      const taskIds = [
        '019a1234-5678-7000-8000-000000000001',
        '019a1234-5678-7000-8000-000000000002',
        '019a1234-5678-7000-8000-000000000003'
      ];
      (fs.readdir as jest.Mock).mockResolvedValue(taskIds);
      (fs.stat as jest.Mock).mockResolvedValue({ isDirectory: () => true } as any);

      const result = await dirManager.listAllTasks();

      expect(result).toEqual(taskIds);
      expect(fs.readdir).toHaveBeenCalledWith(tasksPath);
    });

    it('should handle empty directory', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([]);

      const result = await dirManager.listAllTasks();

      expect(result).toEqual([]);
    });

    it('should skip invalid/corrupted directories', async () => {
      const entries = ['valid-id', '.DS_Store', 'corrupted', 'another-valid-id'];
      (fs.readdir as jest.Mock).mockResolvedValue(entries);
      (fs.stat as jest.Mock).mockImplementation(async (p: string) => {
        if (p.includes('.DS_Store') || p.includes('corrupted')) {
          return { isDirectory: () => false } as any;
        }
        return { isDirectory: () => true } as any;
      });

      const result = await dirManager.listAllTasks();

      expect(result).toEqual(['valid-id', 'another-valid-id']);
    });

    it('should handle readdir errors', async () => {
      (fs.readdir as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      await expect(dirManager.listAllTasks()).rejects.toThrow('Permission denied');
    });

    it('should filter out hidden files (starting with .)', async () => {
      const entries = [
        '019a1234-5678-7000-8000-000000000001',
        '.hidden',
        '019a1234-5678-7000-8000-000000000002',
        '.git'
      ];
      (fs.readdir as jest.Mock).mockResolvedValue(entries);
      (fs.stat as jest.Mock).mockResolvedValue({ isDirectory: () => true } as any);

      const result = await dirManager.listAllTasks();

      expect(result).not.toContain('.hidden');
      expect(result).not.toContain('.git');
      expect(result).toContain('019a1234-5678-7000-8000-000000000001');
    });
  });

  describe('getTaskFilePath', () => {
    it('should return path to task.json', () => {
      const taskId = '019a1234-5678-7000-8000-abcdef123456';
      const expectedPath = path.join(tasksPath, taskId, 'task.json');

      const result = dirManager.getTaskFilePath(taskId);

      expect(result).toBe(expectedPath);
    });
  });

  describe('getTaskReadmePath', () => {
    it('should return path to README.md', () => {
      const taskId = '019a1234-5678-7000-8000-abcdef123456';
      const expectedPath = path.join(tasksPath, taskId, 'README.md');

      const result = dirManager.getTaskReadmePath(taskId);

      expect(result).toBe(expectedPath);
    });
  });

  describe('getTaskArtifactsPath', () => {
    it('should return path to artifacts directory', () => {
      const taskId = '019a1234-5678-7000-8000-abcdef123456';
      const expectedPath = path.join(tasksPath, taskId, 'artifacts');

      const result = dirManager.getTaskArtifactsPath(taskId);

      expect(result).toBe(expectedPath);
    });
  });

  describe('taskExists', () => {
    const testTaskId = '019a1234-5678-7000-8000-abcdef123456';

    it('should return true if task directory exists', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await dirManager.taskExists(testTaskId);

      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith(
        path.join(tasksPath, testTaskId)
      );
    });

    it('should return false if task directory does not exist', async () => {
      (fs.access as jest.Mock).mockRejectedValue({ code: 'ENOENT' });

      const result = await dirManager.taskExists(testTaskId);

      expect(result).toBe(false);
    });

    it('should throw on other errors', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      await expect(dirManager.taskExists(testTaskId)).rejects.toThrow('Permission denied');
    });
  });
});

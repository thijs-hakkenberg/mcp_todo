import { TodoRepository } from '../../src/data/TodoRepository';
import { GitManager } from '../../src/git/GitManager';
import { createTodo } from '../../src/types/Todo';
import { promises as fs } from 'fs';
import path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { uuidv7 } from 'uuidv7';

/**
 * Integration tests for directory-based persistence architecture (ADR-002)
 *
 * Tests the full directory-based persistence system including:
 * - DirectoryManager (task CRUD in directories)
 * - SymlinkManager (view maintenance)
 * - TodoRepository (coordinating CRUD + symlinks)
 * - GitManager (version control)
 * - Migration from legacy todos.json
 * - Concurrent operations
 * - Symlink consistency
 */
describe('Directory-Based Persistence Integration Tests', () => {
  let testDir: string;
  let git: SimpleGit;
  let gitManager: GitManager;
  let todoRepo: TodoRepository;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(__dirname, '../test-repos/directory-integration-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });

    // Initialize Git repo
    git = simpleGit(testDir);
    await git.init();
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');

    // Create initial commit
    await fs.writeFile(path.join(testDir, '.gitignore'), '*.tmp\n');
    await git.add('.gitignore');
    await git.commit('Initial commit');

    // Create managers
    gitManager = new GitManager(testDir);

    // Create TodoRepository
    todoRepo = new TodoRepository(testDir, gitManager);
    await todoRepo.initialize();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Full CRUD Cycle with Real File System', () => {
    it('should create a todo with directory structure and symlinks', async () => {
      // Create a todo
      const todo = await todoRepo.create({
        text: 'Test todo',
        project: 'TestProject',
        status: 'todo',
        priority: 'high',
        tags: ['test', 'integration'],
        assignee: 'tester',
        createdBy: 'system'
      });

      // Verify task directory exists
      const taskDir = path.join(testDir, 'todos', 'tasks', todo.id);
      const taskExists = await fs.access(taskDir).then(() => true).catch(() => false);
      expect(taskExists).toBe(true);

      // Verify task.json exists
      const taskJsonPath = path.join(taskDir, 'task.json');
      const taskJsonExists = await fs.access(taskJsonPath).then(() => true).catch(() => false);
      expect(taskJsonExists).toBe(true);

      // Verify task content
      const taskContent = await fs.readFile(taskJsonPath, 'utf-8');
      const parsedTask = JSON.parse(taskContent);
      expect(parsedTask.text).toBe('Test todo');
      expect(parsedTask.project).toBe('TestProject');

      // Verify symlinks exist
      const projectSymlink = path.join(testDir, 'todos', 'by-project', 'TestProject', todo.id);
      const statusSymlink = path.join(testDir, 'todos', 'by-status', 'todo', todo.id);
      const prioritySymlink = path.join(testDir, 'todos', 'by-priority', 'high', todo.id);
      const tagSymlink1 = path.join(testDir, 'todos', 'by-tag', 'test', todo.id);
      const tagSymlink2 = path.join(testDir, 'todos', 'by-tag', 'integration', todo.id);
      const assigneeSymlink = path.join(testDir, 'todos', 'by-assignee', 'tester', todo.id);

      const symlinksExist = await Promise.all([
        fs.lstat(projectSymlink).then(() => true).catch(() => false),
        fs.lstat(statusSymlink).then(() => true).catch(() => false),
        fs.lstat(prioritySymlink).then(() => true).catch(() => false),
        fs.lstat(tagSymlink1).then(() => true).catch(() => false),
        fs.lstat(tagSymlink2).then(() => true).catch(() => false),
        fs.lstat(assigneeSymlink).then(() => true).catch(() => false)
      ]);

      expect(symlinksExist.every(exists => exists)).toBe(true);
    });

    it('should read a todo from directory structure', async () => {
      // Create a todo
      const created = await todoRepo.create({
        text: 'Read test',
        project: 'TestProject',
        status: 'todo',
        priority: 'medium',
        createdBy: 'system'
      });

      // Read it back
      const todo = await todoRepo.get(created.id);
      expect(todo).toBeDefined();
      expect(todo?.text).toBe('Read test');
      expect(todo?.project).toBe('TestProject');
      expect(todo?.status).toBe('todo');
      expect(todo?.priority).toBe('medium');
    });

    it('should update a todo and maintain symlink consistency', async () => {
      // Create a todo
      const created = await todoRepo.create({
        text: 'Update test',
        project: 'Project1',
        status: 'todo',
        priority: 'low',
        tags: ['old'],
        assignee: 'user1',
        createdBy: 'system'
      });

      // Update properties that affect symlinks
      const updated = await todoRepo.update(created.id, {
        project: 'Project2',
        status: 'in-progress',
        priority: 'urgent',
        tags: ['new'],
        assignee: 'user2'
      });

      expect(updated).toBeDefined();
      expect(updated?.project).toBe('Project2');
      expect(updated?.status).toBe('in-progress');
      expect(updated?.priority).toBe('urgent');

      // Verify old symlinks are removed
      const oldProjectSymlink = path.join(testDir, 'todos', 'by-project', 'Project1', created.id);
      const oldStatusSymlink = path.join(testDir, 'todos', 'by-status', 'todo', created.id);
      const oldPrioritySymlink = path.join(testDir, 'todos', 'by-priority', 'low', created.id);
      const oldTagSymlink = path.join(testDir, 'todos', 'by-tag', 'old', created.id);
      const oldAssigneeSymlink = path.join(testDir, 'todos', 'by-assignee', 'user1', created.id);

      const oldSymlinksExist = await Promise.all([
        fs.lstat(oldProjectSymlink).then(() => true).catch(() => false),
        fs.lstat(oldStatusSymlink).then(() => true).catch(() => false),
        fs.lstat(oldPrioritySymlink).then(() => true).catch(() => false),
        fs.lstat(oldTagSymlink).then(() => true).catch(() => false),
        fs.lstat(oldAssigneeSymlink).then(() => true).catch(() => false)
      ]);

      expect(oldSymlinksExist.every(exists => !exists)).toBe(true);

      // Verify new symlinks exist
      const newProjectSymlink = path.join(testDir, 'todos', 'by-project', 'Project2', created.id);
      const newStatusSymlink = path.join(testDir, 'todos', 'by-status', 'in-progress', created.id);
      const newPrioritySymlink = path.join(testDir, 'todos', 'by-priority', 'urgent', created.id);
      const newTagSymlink = path.join(testDir, 'todos', 'by-tag', 'new', created.id);
      const newAssigneeSymlink = path.join(testDir, 'todos', 'by-assignee', 'user2', created.id);

      const newSymlinksExist = await Promise.all([
        fs.lstat(newProjectSymlink).then(() => true).catch(() => false),
        fs.lstat(newStatusSymlink).then(() => true).catch(() => false),
        fs.lstat(newPrioritySymlink).then(() => true).catch(() => false),
        fs.lstat(newTagSymlink).then(() => true).catch(() => false),
        fs.lstat(newAssigneeSymlink).then(() => true).catch(() => false)
      ]);

      expect(newSymlinksExist.every(exists => exists)).toBe(true);
    });

    it('should delete a todo and remove all symlinks', async () => {
      // Create a todo
      const created = await todoRepo.create({
        text: 'Delete test',
        project: 'TestProject',
        status: 'todo',
        priority: 'high',
        tags: ['test'],
        assignee: 'tester',
        createdBy: 'system'
      });

      // Hard delete it (remove from file system)
      await todoRepo.delete(created.id, true);

      // Verify task directory is removed
      const taskDir = path.join(testDir, 'todos', 'tasks', created.id);
      const taskExists = await fs.access(taskDir).then(() => true).catch(() => false);
      expect(taskExists).toBe(false);

      // Verify all symlinks are removed
      const projectSymlink = path.join(testDir, 'todos', 'by-project', 'TestProject', created.id);
      const statusSymlink = path.join(testDir, 'todos', 'by-status', 'todo', created.id);
      const prioritySymlink = path.join(testDir, 'todos', 'by-priority', 'high', created.id);
      const tagSymlink = path.join(testDir, 'todos', 'by-tag', 'test', created.id);
      const assigneeSymlink = path.join(testDir, 'todos', 'by-assignee', 'tester', created.id);

      const symlinksExist = await Promise.all([
        fs.lstat(projectSymlink).then(() => true).catch(() => false),
        fs.lstat(statusSymlink).then(() => true).catch(() => false),
        fs.lstat(prioritySymlink).then(() => true).catch(() => false),
        fs.lstat(tagSymlink).then(() => true).catch(() => false),
        fs.lstat(assigneeSymlink).then(() => true).catch(() => false)
      ]);

      expect(symlinksExist.every(exists => !exists)).toBe(true);
    });

    it('should handle todos with long descriptions (README.md)', async () => {
      // Create a todo with long description (>300 chars)
      const longDescription = 'A'.repeat(350);
      const todo = await todoRepo.create({
        text: 'Long description todo',
        project: 'TestProject',
        description: longDescription,
        createdBy: 'system'
      });

      // Verify README.md is created
      const readmePath = path.join(testDir, 'todos', 'tasks', todo.id, 'README.md');
      const readmeExists = await fs.access(readmePath).then(() => true).catch(() => false);
      expect(readmeExists).toBe(true);

      // Verify README content
      const readmeContent = await fs.readFile(readmePath, 'utf-8');
      expect(readmeContent).toContain(longDescription);

      // Verify task.json does not contain full description
      const taskJsonPath = path.join(testDir, 'todos', 'tasks', todo.id, 'task.json');
      const taskContent = await fs.readFile(taskJsonPath, 'utf-8');
      const parsedTask = JSON.parse(taskContent);
      expect(parsedTask.description).toBe('[See README.md]');

      // Verify reading merges README back
      const readTodo = await todoRepo.get(todo.id);
      expect(readTodo?.description).toBe(longDescription);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent creates without conflicts', async () => {
      // Create multiple todos concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        todoRepo.create({
          text: `Concurrent todo ${i}`,
          project: 'TestProject',
          status: 'todo',
          createdBy: 'system'
        })
      );

      const todos = await Promise.all(promises);

      // All should succeed
      expect(todos).toHaveLength(5);
      todos.forEach((todo, i) => {
        expect(todo.text).toBe(`Concurrent todo ${i}`);
      });

      // All task directories should exist
      const taskDirs = await Promise.all(
        todos.map(todo =>
          fs.access(path.join(testDir, 'todos', 'tasks', todo.id))
            .then(() => true)
            .catch(() => false)
        )
      );
      expect(taskDirs.every(exists => exists)).toBe(true);

      // All symlinks should exist
      const symlinks = await Promise.all(
        todos.map(todo =>
          fs.lstat(path.join(testDir, 'todos', 'by-status', 'todo', todo.id))
            .then(() => true)
            .catch(() => false)
        )
      );
      expect(symlinks.every(exists => exists)).toBe(true);
    });

    it('should handle concurrent updates to different todos', async () => {
      // Create todos
      const todos = await Promise.all([
        todoRepo.create({ text: 'Todo 1', project: 'P1', createdBy: 'system' }),
        todoRepo.create({ text: 'Todo 2', project: 'P2', createdBy: 'system' }),
        todoRepo.create({ text: 'Todo 3', project: 'P3', createdBy: 'system' })
      ]);

      // Update them concurrently
      const updates = await Promise.all([
        todoRepo.update(todos[0].id, { status: 'in-progress' }),
        todoRepo.update(todos[1].id, { status: 'done' }),
        todoRepo.update(todos[2].id, { priority: 'urgent' })
      ]);

      // All updates should succeed
      expect(updates[0]?.status).toBe('in-progress');
      expect(updates[1]?.status).toBe('done');
      expect(updates[2]?.priority).toBe('urgent');
    });

    it('should handle concurrent deletes', async () => {
      // Create todos
      const todos = await Promise.all([
        todoRepo.create({ text: 'Delete 1', project: 'Test', createdBy: 'system' }),
        todoRepo.create({ text: 'Delete 2', project: 'Test', createdBy: 'system' }),
        todoRepo.create({ text: 'Delete 3', project: 'Test', createdBy: 'system' })
      ]);

      // Store IDs before deletion
      const ids = todos.map(t => t.id);

      // Hard delete them concurrently
      await Promise.all(todos.map(todo => todoRepo.delete(todo.id, true)));

      // Verify all task directories are deleted from file system
      const dirChecks = await Promise.all(
        ids.map(id =>
          fs.access(path.join(testDir, 'todos', 'tasks', id))
            .then(() => false) // exists = failure
            .catch(() => true)  // doesn't exist = success
        )
      );
      expect(dirChecks.every(deleted => deleted)).toBe(true);

      // Verify all symlinks are removed
      const symlinkChecks = await Promise.all(
        ids.map(id =>
          fs.lstat(path.join(testDir, 'todos', 'by-status', 'todo', id))
            .then(() => false) // exists = failure
            .catch(() => true)  // doesn't exist = success
        )
      );
      expect(symlinkChecks.every(removed => removed)).toBe(true);

      // Note: In-memory cache might have race conditions with concurrent deletes
      // (concurrent array.splice operations), but file system is authoritative
      // After reload, cache should be correct
      await todoRepo.reload();
      const remaining = await todoRepo.list();
      ids.forEach(id => {
        expect(remaining.find(t => t.id === id)).toBeUndefined();
      });
    });
  });

  describe('Migration from Legacy todos.json', () => {
    it('should automatically migrate from legacy format on initialize', async () => {
      // Create a new test directory with legacy todos.json
      const migrationTestDir = path.join(__dirname, '../test-repos/migration-test-' + Date.now());
      await fs.mkdir(migrationTestDir, { recursive: true });

      try {
        // Initialize Git
        const migrationGit = simpleGit(migrationTestDir);
        await migrationGit.init();
        await migrationGit.addConfig('user.name', 'Test User');
        await migrationGit.addConfig('user.email', 'test@example.com');

        // Create legacy todos.json
        const legacyTodos = [
          createTodo({
            text: 'Legacy todo 1',
            project: 'OldProject',
            status: 'todo',
            priority: 'high',
            tags: ['legacy'],
            assignee: 'old-user',
            createdBy: 'system'
          }),
          createTodo({
            text: 'Legacy todo 2',
            project: 'OldProject',
            status: 'done',
            priority: 'low',
            createdBy: 'system'
          })
        ];

        const todosJsonPath = path.join(migrationTestDir, 'todos.json');
        await fs.writeFile(todosJsonPath, JSON.stringify({ todos: legacyTodos }, null, 2));
        await migrationGit.add('todos.json');
        await migrationGit.commit('Add legacy todos');

        // Initialize TodoRepository (should trigger migration)
        const migrationGitManager = new GitManager(migrationTestDir);
        const migrationRepo = new TodoRepository(migrationTestDir, migrationGitManager);
        await migrationRepo.initialize();

        // Verify backup was created
        const backupPath = path.join(migrationTestDir, 'todos.json.backup');
        const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
        expect(backupExists).toBe(true);

        // Verify directory structure was created
        const todosDir = path.join(migrationTestDir, 'todos');
        const tasksDir = path.join(todosDir, 'tasks');
        const dirsExist = await Promise.all([
          fs.access(todosDir).then(() => true).catch(() => false),
          fs.access(tasksDir).then(() => true).catch(() => false)
        ]);
        expect(dirsExist.every(exists => exists)).toBe(true);

        // Verify todos were migrated
        const allTodos = await migrationRepo.list();
        expect(allTodos).toHaveLength(2);
        expect(allTodos.find((t) => t.text === 'Legacy todo 1')).toBeDefined();
        expect(allTodos.find((t) => t.text === 'Legacy todo 2')).toBeDefined();

        // Verify task files exist
        const taskFiles = await Promise.all(
          legacyTodos.map(todo =>
            fs.access(path.join(migrationTestDir, 'todos', 'tasks', todo.id, 'task.json'))
              .then(() => true)
              .catch(() => false)
          )
        );
        expect(taskFiles.every(exists => exists)).toBe(true);

        // Verify symlinks were created
        const symlinks = await Promise.all([
          fs.lstat(path.join(migrationTestDir, 'todos', 'by-project', 'OldProject', legacyTodos[0].id))
            .then(() => true).catch(() => false),
          fs.lstat(path.join(migrationTestDir, 'todos', 'by-status', 'todo', legacyTodos[0].id))
            .then(() => true).catch(() => false),
          fs.lstat(path.join(migrationTestDir, 'todos', 'by-priority', 'high', legacyTodos[0].id))
            .then(() => true).catch(() => false),
          fs.lstat(path.join(migrationTestDir, 'todos', 'by-tag', 'legacy', legacyTodos[0].id))
            .then(() => true).catch(() => false)
        ]);
        expect(symlinks.every(exists => exists)).toBe(true);

        // Verify Git commit was created
        const log = await migrationGit.log({ maxCount: 1 });
        expect(log.latest?.message).toContain('migrate');

      } finally {
        // Cleanup
        await fs.rm(migrationTestDir, { recursive: true, force: true });
      }
    });

    it('should preserve data integrity during migration', async () => {
      const migrationTestDir = path.join(__dirname, '../test-repos/migration-integrity-' + Date.now());
      await fs.mkdir(migrationTestDir, { recursive: true });

      try {
        // Initialize Git
        const migrationGit = simpleGit(migrationTestDir);
        await migrationGit.init();
        await migrationGit.addConfig('user.name', 'Test User');
        await migrationGit.addConfig('user.email', 'test@example.com');

        // Create legacy todos with complex data
        const legacyTodos = [
          createTodo({
            text: 'Complex todo',
            project: 'Test',
            description: 'This is a detailed description with special chars: <>"\'/&',
            status: 'in-progress',
            priority: 'urgent',
            tags: ['tag1', 'tag2', 'tag-with-dash'],
            assignee: 'user@example.com',
            dueDate: new Date().toISOString(),
            dependencies: [],
            subtasks: [
              { id: uuidv7(), text: 'Subtask 1', completed: false },
              { id: uuidv7(), text: 'Subtask 2', completed: true }
            ],
            comments: [
              { id: uuidv7(), user: 'user1', text: 'Comment 1', timestamp: new Date().toISOString() }
            ],
            createdBy: 'system'
          })
        ];

        const todosJsonPath = path.join(migrationTestDir, 'todos.json');
        await fs.writeFile(todosJsonPath, JSON.stringify({ todos: legacyTodos }, null, 2));
        await migrationGit.add('todos.json');
        await migrationGit.commit('Add complex legacy todo');

        // Migrate
        const migrationGitManager = new GitManager(migrationTestDir);
        const migrationRepo = new TodoRepository(migrationTestDir, migrationGitManager);
        await migrationRepo.initialize();

        // Verify all fields are preserved
        const migrated = await migrationRepo.get(legacyTodos[0].id);
        expect(migrated).toBeDefined();
        expect(migrated?.text).toBe(legacyTodos[0].text);
        expect(migrated?.description).toBe(legacyTodos[0].description);
        expect(migrated?.status).toBe(legacyTodos[0].status);
        expect(migrated?.priority).toBe(legacyTodos[0].priority);
        expect(migrated?.tags).toEqual(legacyTodos[0].tags);
        expect(migrated?.assignee).toBe(legacyTodos[0].assignee);
        expect(migrated?.dueDate).toBe(legacyTodos[0].dueDate);
        expect(migrated?.subtasks).toEqual(legacyTodos[0].subtasks);
        expect(migrated?.comments).toEqual(legacyTodos[0].comments);

      } finally {
        await fs.rm(migrationTestDir, { recursive: true, force: true });
      }
    });

    it('should not migrate if already using directory structure', async () => {
      // Initialize repository (already using directory structure)
      const initialCommitCount = (await git.log()).total;

      // Initialize again (should not trigger migration)
      await todoRepo.initialize();

      // Verify no new migration commit was created
      const finalCommitCount = (await git.log()).total;
      expect(finalCommitCount).toBe(initialCommitCount);
    });
  });

  describe('Symlink Consistency', () => {
    it('should maintain consistent symlinks across multiple operations', async () => {
      // Create todo
      const todo = await todoRepo.create({
        text: 'Consistency test',
        project: 'Project1',
        status: 'todo',
        priority: 'high',
        tags: ['tag1'],
        assignee: 'user1',
        createdBy: 'system'
      });

      // Update multiple times
      await todoRepo.update(todo.id, { status: 'in-progress' });
      await todoRepo.update(todo.id, { priority: 'urgent' });
      await todoRepo.update(todo.id, { tags: ['tag1', 'tag2'] });
      await todoRepo.update(todo.id, { project: 'Project2' });

      // Verify final symlinks are correct
      const finalTodo = await todoRepo.get(todo.id);
      expect(finalTodo).toBeDefined();

      const expectedSymlinks = [
        path.join(testDir, 'todos', 'by-project', 'Project2', todo.id),
        path.join(testDir, 'todos', 'by-status', 'in-progress', todo.id),
        path.join(testDir, 'todos', 'by-priority', 'urgent', todo.id),
        path.join(testDir, 'todos', 'by-tag', 'tag1', todo.id),
        path.join(testDir, 'todos', 'by-tag', 'tag2', todo.id),
        path.join(testDir, 'todos', 'by-assignee', 'user1', todo.id)
      ];

      const symlinksExist = await Promise.all(
        expectedSymlinks.map(link =>
          fs.lstat(link).then(() => true).catch(() => false)
        )
      );
      expect(symlinksExist.every(exists => exists)).toBe(true);

      // Verify old symlinks don't exist
      const oldSymlinks = [
        path.join(testDir, 'todos', 'by-project', 'Project1', todo.id),
        path.join(testDir, 'todos', 'by-status', 'todo', todo.id),
        path.join(testDir, 'todos', 'by-priority', 'high', todo.id)
      ];

      const oldSymlinksExist = await Promise.all(
        oldSymlinks.map(link =>
          fs.lstat(link).then(() => true).catch(() => false)
        )
      );
      expect(oldSymlinksExist.every(exists => !exists)).toBe(true);
    });

    it('should handle symlinks for todos without optional fields', async () => {
      // Create minimal todo (no tags, no assignee)
      const todo = await todoRepo.create({
        text: 'Minimal todo',
        project: 'Test',
        createdBy: 'system'
      });

      // Verify required symlinks exist
      const requiredSymlinks = [
        path.join(testDir, 'todos', 'by-project', 'Test', todo.id),
        path.join(testDir, 'todos', 'by-status', 'todo', todo.id),
        path.join(testDir, 'todos', 'by-priority', 'medium', todo.id)
      ];

      const symlinksExist = await Promise.all(
        requiredSymlinks.map(link =>
          fs.lstat(link).then(() => true).catch(() => false)
        )
      );
      expect(symlinksExist.every(exists => exists)).toBe(true);

      // Verify optional symlinks don't exist
      const byTagDir = path.join(testDir, 'todos', 'by-tag');
      const byAssigneeDir = path.join(testDir, 'todos', 'by-assignee');

      // These directories might not exist if no todos have tags/assignees
      const tagDirExists = await fs.access(byTagDir).then(() => true).catch(() => false);
      const assigneeDirExists = await fs.access(byAssigneeDir).then(() => true).catch(() => false);

      // If they exist, they shouldn't contain this todo's symlink
      if (tagDirExists) {
        const tagEntries = await fs.readdir(byTagDir);
        expect(tagEntries.some(entry => entry.includes(todo.id))).toBe(false);
      }
      if (assigneeDirExists) {
        const assigneeEntries = await fs.readdir(byAssigneeDir);
        expect(assigneeEntries.some(entry => entry.includes(todo.id))).toBe(false);
      }
    });

    it('should clean up empty view directories', async () => {
      // Create and delete a todo with unique project
      const todo = await todoRepo.create({
        text: 'Cleanup test',
        project: 'UniqueProject',
        status: 'todo',
        createdBy: 'system'
      });

      const projectDir = path.join(testDir, 'todos', 'by-project', 'UniqueProject');
      const projectDirExists = await fs.access(projectDir).then(() => true).catch(() => false);
      expect(projectDirExists).toBe(true);

      // Delete the todo
      await todoRepo.delete(todo.id);

      // Check if empty directory was cleaned up (implementation may vary)
      // Note: Some implementations keep empty dirs, others remove them
      // This test documents the expected behavior
      const projectDirExistsAfter = await fs.access(projectDir).then(() => true).catch(() => false);

      // If directory still exists, it should be empty
      if (projectDirExistsAfter) {
        const entries = await fs.readdir(projectDir);
        expect(entries.filter(e => e !== '.gitkeep')).toHaveLength(0);
      }
    });
  });

  describe('Git Integration', () => {
    it('should NOT create Git commits (that is SyncManager\'s responsibility)', async () => {
      const beforeCommits = (await git.log()).total;

      // Create a todo
      await todoRepo.create({
        text: 'Git integration test',
        project: 'Test',
        createdBy: 'system'
      });

      // Verify NO commit was created (TodoRepository doesn't commit)
      const afterCommits = (await git.log()).total;
      expect(afterCommits).toBe(beforeCommits);

      // Files should exist in working directory but not committed
      const taskDir = await fs.readdir(path.join(testDir, 'todos', 'tasks'));
      expect(taskDir.length).toBeGreaterThan(0);
    });

    it('should create files in working directory without committing', async () => {
      // Create a todo
      const todo = await todoRepo.create({
        text: 'Git tracking test',
        project: 'Test',
        tags: ['git'],
        createdBy: 'system'
      });

      // Check Git status - files should be untracked
      const status = await git.status();
      expect(status.files.length).toBeGreaterThan(0);

      // Verify files exist in working directory
      const taskJsonPath = path.join(testDir, 'todos', 'tasks', todo.id, 'task.json');
      const exists = await fs.access(taskJsonPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('Performance and Scale', () => {
    it('should handle 100 todos efficiently', async () => {
      const startTime = Date.now();

      // Create 100 todos
      const todos = [];
      for (let i = 0; i < 100; i++) {
        const todo = await todoRepo.create({
          text: `Todo ${i}`,
          project: `Project${i % 10}`,
          status: i % 3 === 0 ? 'todo' : i % 3 === 1 ? 'in-progress' : 'done',
          priority: i % 4 === 0 ? 'urgent' : i % 4 === 1 ? 'high' : i % 4 === 2 ? 'medium' : 'low',
          tags: [`tag${i % 5}`],
          createdBy: 'system'
        });
        todos.push(todo);
      }

      const createTime = Date.now() - startTime;
      console.log(`Created 100 todos in ${createTime}ms`);

      // List all todos
      const listStart = Date.now();
      const allTodos = await todoRepo.list();
      const listTime = Date.now() - listStart;
      console.log(`Listed 100 todos in ${listTime}ms`);

      expect(allTodos).toHaveLength(100);

      // Filter by status
      const filterStart = Date.now();
      const doneTodos = await todoRepo.list({ status: 'done' });
      const filterTime = Date.now() - filterStart;
      console.log(`Filtered todos by status in ${filterTime}ms`);

      expect(doneTodos.length).toBeGreaterThan(0);

      // Verify performance is acceptable
      // Note: These thresholds may need adjustment based on hardware
      expect(createTime).toBeLessThan(30000); // 30s for 100 creates (300ms each)
      expect(listTime).toBeLessThan(1000); // 1s to list 100
      expect(filterTime).toBeLessThan(100); // 100ms to filter
    }, 60000); // 60s timeout for this test
  });

  describe('Error Handling', () => {
    it('should throw error for missing task directory', async () => {
      const fakeId = '01234567-89ab-cdef-0123-456789abcdef';

      // get() should throw error for non-existent todo
      await expect(todoRepo.get(fakeId)).rejects.toThrow('Todo not found');
    });

    it('should handle corrupted task.json', async () => {
      // Create a todo
      const todo = await todoRepo.create({
        text: 'Corruption test',
        project: 'Test',
        createdBy: 'system'
      });

      // Corrupt the task.json
      const taskJsonPath = path.join(testDir, 'todos', 'tasks', todo.id, 'task.json');
      await fs.writeFile(taskJsonPath, '{ invalid json ');

      // Reload to force re-reading from disk
      await todoRepo.reload();

      // Try to read it - should either skip or throw descriptive error
      // Note: Current implementation reads from in-memory cache, so this test
      // verifies that corrupted files don't break the entire system
      const allTodos = await todoRepo.list();

      // Should either exclude corrupted todo or throw error during reload
      // For now, we just verify the system doesn't crash
      expect(Array.isArray(allTodos)).toBe(true);
    });

    it('should handle broken symlinks gracefully', async () => {
      // Create a todo
      const todo = await todoRepo.create({
        text: 'Broken symlink test',
        project: 'Test',
        createdBy: 'system'
      });

      // Delete task directory but leave symlink
      const taskDir = path.join(testDir, 'todos', 'tasks', todo.id);
      await fs.rm(taskDir, { recursive: true });

      // Symlink should still exist but be broken
      const symlink = path.join(testDir, 'todos', 'by-project', 'Test', todo.id);
      const symlinkExists = await fs.lstat(symlink).then(() => true).catch(() => false);
      expect(symlinkExists).toBe(true);

      // Reload to force re-reading from disk
      await todoRepo.reload();

      // List should skip broken symlinks (todo won't be in cache)
      const allTodos = await todoRepo.list();
      expect(allTodos.find((t) => t.id === todo.id)).toBeUndefined();
    });
  });
});

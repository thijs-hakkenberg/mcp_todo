import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTodoStore } from '../todos.svelte';
import type { Todo } from '../../../types/Todo';

describe('TodoStore Factory Pattern', () => {
  describe('Factory Function Basics', () => {
    it('should create a new store instance', () => {
      const store = createTodoStore();

      expect(store).toBeDefined();
      expect(store.todos).toBeDefined();
      expect(store.loadTodos).toBeDefined();
    });

    it('should create independent instances', () => {
      const store1 = createTodoStore();
      const store2 = createTodoStore();

      expect(store1).not.toBe(store2);
      expect(store1.todos).not.toBe(store2.todos);
    });

    it('should initialize with correct default state', () => {
      const store = createTodoStore();

      expect(store.todos).toEqual([]);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.filters).toEqual({
        search: '',
        projects: [],
        tags: [],
        priority: 'all',
        assignee: 'all',
        includeCompleted: false
      });
    });
  });

  describe('State Isolation', () => {
    it('should maintain separate state between instances', () => {
      const store1 = createTodoStore();
      const store2 = createTodoStore();

      const mockTodo: Todo = {
        id: '1',
        text: 'Test todo',
        status: 'todo',
        priority: 'medium',
        project: 'test',
        tags: [],
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        fieldTimestamps: {},
        createdBy: 'test-user'
      };

      // Modify store1
      store1.todos = [mockTodo];

      // store2 should remain unaffected
      expect(store1.todos).toHaveLength(1);
      expect(store2.todos).toHaveLength(0);
    });

    it('should maintain separate filters between instances', () => {
      const store1 = createTodoStore();
      const store2 = createTodoStore();

      // Modify store1 filters
      store1.setProjectsFilter(['project1']);

      // store2 filters should remain unchanged
      expect(store1.filters.projects).toEqual(['project1']);
      expect(store2.filters.projects).toEqual([]);
    });

    it('should maintain separate loading state between instances', () => {
      const store1 = createTodoStore();
      const store2 = createTodoStore();

      // Simulate loading in store1
      store1.loading = true;

      expect(store1.loading).toBe(true);
      expect(store2.loading).toBe(false);
    });
  });

  describe('Reactive State', () => {
    it('should expose todos as reactive state', () => {
      const store = createTodoStore();
      const mockTodo: Todo = {
        id: '1',
        text: 'Test todo',
        status: 'todo',
        priority: 'medium',
        project: 'test',
        tags: [],
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        fieldTimestamps: {},
        createdBy: 'test-user'
      };

      store.todos = [mockTodo];

      expect(store.todos).toEqual([mockTodo]);
      expect(store.todos[0].text).toBe('Test todo');
    });

    it('should expose filters as reactive state', () => {
      const store = createTodoStore();

      store.filters = {
        projects: ['work'],
        tags: ['urgent'],
        priority: 'high',
        assignee: 'user-123',
        includeCompleted: true
      };

      expect(store.filters.projects).toEqual(['work']);
      expect(store.filters.tags).toEqual(['urgent']);
      expect(store.filters.priority).toBe('high');
    });

    it('should expose error as reactive state', () => {
      const store = createTodoStore();

      store.error = 'Test error message';

      expect(store.error).toBe('Test error message');
    });
  });

  describe('Derived State', () => {
    it('should compute filteredTodos based on filters', () => {
      const store = createTodoStore();

      const todos: Todo[] = [
        {
          id: '1',
          text: 'Todo 1',
          status: 'todo',
          priority: 'high',
          project: 'work',
          tags: ['backend'],
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          fieldTimestamps: {},
          createdBy: 'user-1'
        },
        {
          id: '2',
          text: 'Todo 2',
          status: 'done',
          priority: 'low',
          project: 'personal',
          tags: ['frontend'],
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          fieldTimestamps: {},
          createdBy: 'user-2'
        }
      ];

      store.todos = todos;

      // Initially, includeCompleted is false, so only 'todo' status should show
      expect(store.filteredTodos).toHaveLength(1);
      expect(store.filteredTodos[0].id).toBe('1');
    });

    it('should compute columnTodos grouped by status', () => {
      const store = createTodoStore();

      const todos: Todo[] = [
        {
          id: '1',
          text: 'Todo 1',
          status: 'todo',
          priority: 'high',
          project: 'work',
          tags: [],
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          fieldTimestamps: {},
          createdBy: 'user-1'
        },
        {
          id: '2',
          text: 'Todo 2',
          status: 'in-progress',
          priority: 'medium',
          project: 'work',
          tags: [],
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          fieldTimestamps: {},
          createdBy: 'user-1'
        },
        {
          id: '3',
          text: 'Todo 3',
          status: 'done',
          priority: 'low',
          project: 'work',
          tags: [],
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          fieldTimestamps: {},
          createdBy: 'user-1'
        }
      ];

      store.todos = todos;
      store.filters = { ...store.filters, includeCompleted: true };

      expect(store.columnTodos.todo).toHaveLength(1);
      expect(store.columnTodos['in-progress']).toHaveLength(1);
      expect(store.columnTodos.blocked).toHaveLength(0);
      expect(store.columnTodos.done).toHaveLength(1);
    });

    it('should compute statistics correctly', () => {
      const store = createTodoStore();

      const todos: Todo[] = [
        {
          id: '1',
          text: 'Todo 1',
          status: 'todo',
          priority: 'high',
          project: 'work',
          tags: [],
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          fieldTimestamps: {},
          createdBy: 'user-1'
        },
        {
          id: '2',
          text: 'Todo 2',
          status: 'done',
          priority: 'medium',
          project: 'work',
          tags: [],
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          fieldTimestamps: {},
          createdBy: 'user-1'
        }
      ];

      store.todos = todos;
      store.filters = { ...store.filters, includeCompleted: true };

      expect(store.statistics.total).toBe(2);
      expect(store.statistics.byStatus.todo).toBe(1);
      expect(store.statistics.byStatus.done).toBe(1);
      expect(store.statistics.completionRate).toBe(50);
    });
  });

  describe('Fresh Instances in Tests', () => {
    let store: ReturnType<typeof createTodoStore>;

    beforeEach(() => {
      // Each test gets a fresh store instance
      store = createTodoStore();
    });

    it('should start with empty todos', () => {
      expect(store.todos).toEqual([]);
    });

    it('should reset state between tests', () => {
      // This test runs after the previous one
      // If instances aren't fresh, this would fail
      expect(store.todos).toEqual([]);
      expect(store.loading).toBe(false);
    });
  });
});

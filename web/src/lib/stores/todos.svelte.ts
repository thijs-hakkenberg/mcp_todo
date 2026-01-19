import type { Todo, CreateTodoInput, UpdateTodoInput, TodoFilters } from '../types/Todo';

/**
 * Create a new TodoStore instance using Svelte 5 Runes.
 * Factory pattern enables proper testing by creating independent store instances.
 *
 * @returns A new TodoStore instance with reactive state and methods
 */
export function createTodoStore() {
  // State using $state rune
  let todos = $state<Todo[]>([]);
  let filters = $state<TodoFilters>({
    search: '',
    projects: [], // Empty = all
    priority: 'all',
    tags: [], // Empty = all
    assignee: 'all',
    includeCompleted: false // Default: hide completed todos
  });
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Derived state using $derived rune
  const filteredTodos = $derived.by(() => {
    let filtered = [...todos];

    // Include/exclude completed todos (default: exclude)
    if (!filters.includeCompleted) {
      filtered = filtered.filter(todo => todo.status !== 'done');
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(todo =>
        todo.text.toLowerCase().includes(searchLower) ||
        todo.description?.toLowerCase().includes(searchLower) ||
        todo.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Projects filter (empty array = all)
    if (filters.projects.length > 0) {
      filtered = filtered.filter(todo => filters.projects.includes(todo.project));
    }

    // Priority filter
    if (filters.priority !== 'all') {
      filtered = filtered.filter(todo => todo.priority === filters.priority);
    }

    // Tags filter (empty array = all)
    if (filters.tags.length > 0) {
      filtered = filtered.filter(todo =>
        todo.tags.some(tag => filters.tags.includes(tag))
      );
    }

    // Assignee filter
    if (filters.assignee !== 'all') {
      if (filters.assignee === 'unassigned') {
        filtered = filtered.filter(todo => !todo.assignee);
      } else {
        filtered = filtered.filter(todo => todo.assignee === filters.assignee);
      }
    }

    // Status filter (if provided) - explicit status filter overrides includeCompleted
    if (filters.status) {
      filtered = filtered.filter(todo => todo.status === filters.status);
    }

    return filtered;
  });

  const columnTodos = $derived.by(() => {
    // Sort once, then partition into columns (more efficient than sorting 4 times)
    const sorted = [...filteredTodos].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Partition into columns in a single pass
    const columns: Record<Todo['status'], Todo[]> = {
      'todo': [],
      'in-progress': [],
      'blocked': [],
      'done': []
    };

    for (const todo of sorted) {
      columns[todo.status].push(todo);
    }

    return columns;
  });

  const statistics = $derived.by(() => {
    const total = todos.length;
    const byStatus = {
      'todo': todos.filter(t => t.status === 'todo').length,
      'in-progress': todos.filter(t => t.status === 'in-progress').length,
      'blocked': todos.filter(t => t.status === 'blocked').length,
      'done': todos.filter(t => t.status === 'done').length
    };
    const completionRate = total > 0
      ? Math.round((byStatus.done / total) * 10000) / 100
      : 0;

    return {
      total,
      byStatus,
      completionRate
    };
  });

  // API Methods
  async function loadTodos(): Promise<void> {
    console.log('[TodoStore] loadTodos called');
    loading = true;
    error = null;

    try {
      // Build query parameters for field selection and filtering
      const params = new URLSearchParams();
      params.append('mode', 'standard'); // Use standard mode for reduced payload
      params.append('includeCompleted', String(filters.includeCompleted !== false)); // Convert to API format

      console.log('[TodoStore] Fetching from /api/todos with params:', params.toString());
      const response = await fetch(`/api/todos?${params.toString()}`);
      console.log('[TodoStore] Response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('[TodoStore] Data received:', { success: data.success, count: data.todos?.length });

      if (data.success) {
        todos = data.todos;
        console.log('[TodoStore] Todos set to:', todos.length, 'items');
      } else {
        throw new Error(data.error || 'Failed to load todos');
      }
    } catch (err: any) {
      error = `Failed to load todos: ${err.message}`;
      console.error('[TodoStore] Error loading todos:', err);
    } finally {
      loading = false;
      console.log('[TodoStore] Loading complete. Total todos:', todos.length);
    }
  }

  async function createTodo(input: CreateTodoInput): Promise<void> {
    error = null;

    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        todos = [data.todo, ...todos];
      } else {
        throw new Error(data.error || 'Failed to create todo');
      }
    } catch (err: any) {
      error = `Failed to create todo: ${err.message}`;
      console.error('Error creating todo:', err);
      throw err;
    }
  }

  async function updateTodo(id: string, updates: UpdateTodoInput): Promise<void> {
    error = null;

    // Optimistic update
    const originalTodo = todos.find(t => t.id === id);
    if (!originalTodo) return;

    const todoIndex = todos.findIndex(t => t.id === id);
    const updatedTodo = { ...originalTodo, ...updates };
    todos[todoIndex] = updatedTodo;

    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        todos[todoIndex] = data.todo;
      } else {
        throw new Error(data.error || 'Failed to update todo');
      }
    } catch (err: any) {
      // Rollback on error
      todos[todoIndex] = originalTodo;
      error = `Failed to update todo: ${err.message}`;
      console.error('Error updating todo:', err);
      throw err;
    }
  }

  async function updateTodoStatus(id: string, status: Todo['status']): Promise<void> {
    error = null;

    // Optimistic update
    const originalTodo = todos.find(t => t.id === id);
    if (!originalTodo) return;

    const todoIndex = todos.findIndex(t => t.id === id);
    todos[todoIndex] = { ...originalTodo, status };

    try {
      const response = await fetch(`/api/todos/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        todos[todoIndex] = data.todo;
      } else {
        throw new Error(data.error || 'Failed to update todo status');
      }
    } catch (err: any) {
      // Rollback on error
      todos[todoIndex] = originalTodo;
      error = `Failed to update todo status: ${err.message}`;
      console.error('Error updating todo status:', err);
    }
  }

  async function deleteTodo(id: string): Promise<void> {
    error = null;

    // Optimistic update
    const originalTodos = [...todos];
    todos = todos.filter(t => t.id !== id);

    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete todo');
      }
    } catch (err: any) {
      // Rollback on error
      todos = originalTodos;
      error = `Failed to delete todo: ${err.message}`;
      console.error('Error deleting todo:', err);
      throw err;
    }
  }

  async function completeTodo(id: string): Promise<void> {
    await updateTodoStatus(id, 'done');
  }

  async function addComment(id: string, comment: string): Promise<void> {
    error = null;

    try {
      const response = await fetch(`/api/todos/${id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const todoIndex = todos.findIndex(t => t.id === id);
        if (todoIndex !== -1) {
          todos[todoIndex] = data.todo;
        }
      } else {
        throw new Error(data.error || 'Failed to add comment');
      }
    } catch (err: any) {
      error = `Failed to add comment: ${err.message}`;
      console.error('Error adding comment:', err);
      throw err;
    }
  }

  // Filter Management
  function setSearchFilter(search: string): void {
    filters.search = search;
  }

  function setProjectsFilter(projects: string[]): void {
    filters.projects = projects;
  }

  function setPriorityFilter(priority: string): void {
    filters.priority = priority;
  }

  function setTagsFilter(tags: string[]): void {
    filters.tags = tags;
  }

  function setAssigneeFilter(assignee: string): void {
    filters.assignee = assignee;
  }

  function setIncludeCompletedFilter(includeCompleted: boolean): void {
    filters.includeCompleted = includeCompleted;
    // Reload todos when this filter changes to fetch from API
    loadTodos();
  }

  function clearFilters(): void {
    filters = {
      search: '',
      projects: [],
      priority: 'all',
      tags: [],
      assignee: 'all',
      includeCompleted: false // Default: hide completed
    };
  }

  // Reset store (for testing)
  function reset(): void {
    todos = [];
    filters = {
      search: '',
      projects: [],
      priority: 'all',
      tags: [],
      assignee: 'all',
      includeCompleted: false
    };
    loading = false;
    error = null;
  }

  // Return store interface with getters/setters for reactive state
  return {
    // State (getters and setters for primitives, direct access for objects/arrays)
    get todos() { return todos; },
    set todos(value: Todo[]) { todos = value; },

    get filters() { return filters; },
    set filters(value: TodoFilters) { filters = value; },

    get loading() { return loading; },
    set loading(value: boolean) { loading = value; },

    get error() { return error; },
    set error(value: string | null) { error = value; },

    // Derived state (read-only)
    get filteredTodos() { return filteredTodos; },
    get columnTodos() { return columnTodos; },
    get statistics() { return statistics; },

    // Methods
    loadTodos,
    createTodo,
    updateTodo,
    updateTodoStatus,
    deleteTodo,
    completeTodo,
    addComment,
    setSearchFilter,
    setProjectsFilter,
    setPriorityFilter,
    setTagsFilter,
    setAssigneeFilter,
    setIncludeCompletedFilter,
    clearFilters,
    reset
  };
}

// Export singleton instance for backward compatibility with components
export const todoStore = createTodoStore();
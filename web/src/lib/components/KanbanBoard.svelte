<script lang="ts">
  import { onMount } from 'svelte';
  import { todoStore } from '../stores/todos.svelte';
  import type { Todo, CreateTodoInput, UpdateTodoInput } from '../types/Todo';
  import FilterBar from './FilterBar.svelte';
  import KanbanColumn from './KanbanColumn.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import TodoDetailModal from './modals/TodoDetailModal.svelte';
  import TodoAddModal from './modals/TodoAddModal.svelte';
  import TodoEditModal from './modals/TodoEditModal.svelte';

  let { allowColumnReorder = false, readOnly = false } = $props<{
    allowColumnReorder?: boolean;
    readOnly?: boolean;
  }>();

  let selectedTodo = $state<Todo | null>(null);
  let showAddModal = $state(false);
  let showEditModal = $state(false);
  let editingTodo = $state<Todo | null>(null);
  let addModalStatus = $state<Todo['status']>('todo');

  onMount(() => {
    console.log('[KanbanBoard] onMount - calling loadTodos');
    todoStore.loadTodos();
  });

  // Debug reactive values
  $effect(() => {
    console.log('[KanbanBoard] Reactive update:', {
      todosLength: todoStore.todos.length,
      statisticsTotal: todoStore.statistics.total,
      columnTodosKeys: Object.keys(todoStore.columnTodos),
      loading: todoStore.loading
    });
  });

  async function handleDrop(event: { todoId: string; targetStatus: Todo['status'] }) {
    if (!readOnly) {
      await todoStore.updateTodoStatus(event.todoId, event.targetStatus);
    }
  }

  function handleTodoDblClick(todo: Todo) {
    if (!readOnly) {
      selectedTodo = todo;
    }
  }

  function handleAddTodo(status: Todo['status']) {
    if (!readOnly) {
      addModalStatus = status;
      showAddModal = true;
    }
  }

  function closeModals() {
    selectedTodo = null;
    showAddModal = false;
    showEditModal = false;
    editingTodo = null;
  }

  function handleEditTodo(todo: Todo) {
    editingTodo = todo;
    showEditModal = true;
    selectedTodo = null;
  }

  async function handleRefresh() {
    await todoStore.loadTodos();
  }

  async function handleCreateTodo(input: CreateTodoInput) {
    await todoStore.createTodo(input);
  }

  async function handleUpdateTodo(id: string, updates: UpdateTodoInput) {
    await todoStore.updateTodo(id, updates);
  }

  const columns = [
    { title: 'To Do', status: 'todo' as const },
    { title: 'In Progress', status: 'in-progress' as const },
    { title: 'Blocked', status: 'blocked' as const },
    { title: 'Done', status: 'done' as const }
  ];
</script>

<div class="kanban-board min-h-screen" style="background-color: #0e0e10;">
  <!-- Header with Statistics -->
  <div class="shadow-sm border-b" style="background-color: #141416; border-color: #23252a;">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-semibold" style="color: #e8e9ec;">Todo Kanban Board</h1>
          <div class="mt-1 flex items-center gap-4 text-xs" style="color: #7a7c82;">
            <span>Total: {todoStore.statistics.total}</span>
            <span>•</span>
            <span>Completed: {todoStore.statistics.byStatus.done}</span>
            <span>•</span>
            <span class="font-semibold" style="color: #5cb365;">
              {todoStore.statistics.completionRate}% Complete
            </span>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <ThemeToggle />
          <button
            class="refresh-button px-3 py-1.5 text-white rounded flex items-center gap-1.5 font-medium text-sm transition-all"
            style="background-color: #e8724e;"
            onmouseenter={(e) => e.currentTarget.style.backgroundColor = '#f07d55'}
            onmouseleave={(e) => e.currentTarget.style.backgroundColor = '#e8724e'}
            onclick={handleRefresh}
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            Refresh
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Filter Bar -->
  <FilterBar />

  <!-- Loading State -->
  {#if todoStore.loading}
    <div class="flex items-center justify-center py-20">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p class="mt-4 text-gray-600">Loading todos...</p>
      </div>
    </div>
  {/if}

  <!-- Error State -->
  {#if todoStore.error}
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-800">{todoStore.error}</p>
      </div>
    </div>
  {/if}

  <!-- Kanban Columns -->
  {#if !todoStore.loading}
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {#each columns as column}
          <KanbanColumn
            title={column.title}
            status={column.status}
            todos={todoStore.columnTodos[column.status]}
            ondrop={handleDrop}
            ontododblclick={handleTodoDblClick}
            onaddtodo={readOnly ? undefined : handleAddTodo}
          />
        {/each}
      </div>
    </div>
  {/if}

  <!-- Todo Detail Modal -->
  {#if selectedTodo}
    <TodoDetailModal
      todo={selectedTodo}
      {readOnly}
      onclose={closeModals}
      onedit={handleEditTodo}
    />
  {/if}

  <!-- Add Todo Modal -->
  {#if showAddModal}
    <TodoAddModal
      status={addModalStatus}
      onclose={closeModals}
      oncreate={handleCreateTodo}
    />
  {/if}

  <!-- Edit Todo Modal -->
  {#if showEditModal && editingTodo}
    <TodoEditModal
      todo={editingTodo}
      onclose={closeModals}
      onupdate={handleUpdateTodo}
    />
  {/if}
</div>

<style>
  .kanban-board {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }

  /* Loading spinner animation */
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import { todoStore } from '../stores/todos.svelte';
  import type { Todo } from '../types/Todo';
  import FilterBar from './FilterBar.svelte';
  import KanbanColumn from './KanbanColumn.svelte';
  import ProjectAutocomplete from './ProjectAutocomplete.svelte';

  // Configure marked for safe HTML rendering
  marked.setOptions({
    breaks: true,
    gfm: true
  });

  let { allowColumnReorder = false, readOnly = false } = $props<{
    allowColumnReorder?: boolean;
    readOnly?: boolean;
  }>();

  let selectedTodo = $state<Todo | null>(null);
  let showAddModal = $state(false);
  let showEditModal = $state(false);
  let editingTodo = $state<Todo | null>(null);
  let addModalStatus = $state<Todo['status']>('todo');
  let isSubmitting = $state(false);
  let addModalProject = $state('');
  let editModalProject = $state('');

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
      addModalProject = '';
      showAddModal = true;
    }
  }

  function closeModal() {
    selectedTodo = null;
    showAddModal = false;
    showEditModal = false;
    editingTodo = null;
  }

  function handleEditTodo(todo: Todo) {
    editingTodo = todo;
    editModalProject = todo.project;
    showEditModal = true;
    selectedTodo = null; // Close detail modal
  }

  async function handleRefresh() {
    await todoStore.loadTodos();
  }

  function renderMarkdown(text: string): string {
    try {
      return marked(text) as string;
    } catch (error) {
      console.error('Error rendering markdown:', error);
      return text;
    }
  }

  function hasLongDescription(todo: Todo): boolean {
    return todo.description?.length > 300 || todo.description === '[See README.md]';
  }

  const columns = [
    { title: 'To Do', status: 'todo' as const },
    { title: 'In Progress', status: 'in-progress' as const },
    { title: 'Blocked', status: 'blocked' as const },
    { title: 'Done', status: 'done' as const }
  ];
</script>

<div class="kanban-board min-h-screen bg-gray-50">
  <!-- Header with Statistics -->
  <div class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Todo Kanban Board</h1>
          <div class="mt-1 flex items-center gap-4 text-sm text-gray-600">
            <span>Total: {todoStore.statistics.total}</span>
            <span>•</span>
            <span>Completed: {todoStore.statistics.byStatus.done}</span>
            <span>•</span>
            <span class="font-medium text-green-600">
              {todoStore.statistics.completionRate}% Complete
            </span>
          </div>
        </div>
        <button
          class="refresh-button px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          on:click={handleRefresh}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
          Refresh
        </button>
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
    <div class="todo-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex items-start justify-between mb-4">
            <h2 class="text-xl font-bold text-gray-900">{selectedTodo.text}</h2>
            <button
              class="text-gray-400 hover:text-gray-600"
              on:click={closeModal}
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          {#if selectedTodo.description}
            <div class="mb-4">
              <h3 class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                Description
                {#if hasLongDescription(selectedTodo)}
                  <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Long description">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                {/if}
              </h3>
              <div class="prose prose-sm max-w-none text-gray-600">
                {@html renderMarkdown(selectedTodo.description)}
              </div>
            </div>
          {/if}

          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <h3 class="text-sm font-medium text-gray-700 mb-1">Status</h3>
              <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full
                {selectedTodo.status === 'todo' ? 'bg-gray-100 text-gray-700' :
                 selectedTodo.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                 selectedTodo.status === 'blocked' ? 'bg-red-100 text-red-700' :
                 'bg-green-100 text-green-700'}">
                {selectedTodo.status}
              </span>
            </div>

            <div>
              <h3 class="text-sm font-medium text-gray-700 mb-1">Priority</h3>
              <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full
                {selectedTodo.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                 selectedTodo.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                 selectedTodo.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                 'bg-green-100 text-green-700'}">
                {selectedTodo.priority}
              </span>
            </div>
          </div>

          {#if selectedTodo.tags.length > 0}
            <div class="mb-4">
              <h3 class="text-sm font-medium text-gray-700 mb-1">Tags</h3>
              <div class="flex flex-wrap gap-1">
                {#each selectedTodo.tags as tag}
                  <span class="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                    {tag}
                  </span>
                {/each}
              </div>
            </div>
          {/if}

          {#if selectedTodo.assignee}
            <div class="mb-4">
              <h3 class="text-sm font-medium text-gray-700 mb-1">Assignee</h3>
              <p class="text-gray-600">{selectedTodo.assignee}</p>
            </div>
          {/if}

          {#if selectedTodo.dueDate}
            <div class="mb-4">
              <h3 class="text-sm font-medium text-gray-700 mb-1">Due Date</h3>
              <p class="text-gray-600">
                {new Date(selectedTodo.dueDate).toLocaleDateString()}
              </p>
            </div>
          {/if}

          <div class="flex justify-end gap-2 mt-6">
            <button
              class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              on:click={closeModal}
            >
              Close
            </button>
            {#if !readOnly}
              <button
                class="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                on:click={() => {
                  if (selectedTodo) {
                    handleEditTodo(selectedTodo);
                  }
                }}
              >
                Edit
              </button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Add Todo Modal -->
  {#if showAddModal}
    <div class="add-todo-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg max-w-md w-full">
        <div class="p-6">
          <h2 class="text-xl font-bold text-gray-900 mb-4">Add New Todo</h2>

          <form on:submit|preventDefault={async (e) => {
            if (isSubmitting) return; // Prevent double submission
            isSubmitting = true;

            try {
              const formData = new FormData(e.currentTarget);
              await todoStore.createTodo({
                text: formData.get('text') as string,
                description: formData.get('description') as string || undefined,
                status: addModalStatus,
                priority: formData.get('priority') as Todo['priority'],
                project: addModalProject,
                tags: (formData.get('tags') as string || '').split(',').map(t => t.trim()).filter(Boolean),
                assignee: formData.get('assignee') as string || undefined
              });
              closeModal();
            } catch (error) {
              console.error('Error creating todo:', error);
            } finally {
              isSubmitting = false;
            }
          }}>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  name="text"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    name="priority"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Project *</label>
                  <ProjectAutocomplete bind:value={addModalProject} required />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  name="tags"
                  placeholder="bug, feature, ui"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
                <input
                  type="text"
                  name="assignee"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div class="flex justify-end gap-2 mt-6">
              <button
                type="button"
                class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                on:click={closeModal}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                class="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Adding...' : 'Add Todo'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  {/if}

  <!-- Edit Todo Modal -->
  {#if showEditModal && editingTodo}
    <div class="edit-todo-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg max-w-md w-full">
        <div class="p-6">
          <h2 class="text-xl font-bold text-gray-900 mb-4">Edit Todo</h2>

          <form on:submit|preventDefault={async (e) => {
            if (isSubmitting) return; // Prevent double submission
            isSubmitting = true;

            try {
              const formData = new FormData(e.currentTarget);
              await todoStore.updateTodo(editingTodo.id, {
                text: formData.get('text') as string,
                description: formData.get('description') as string || undefined,
                status: formData.get('status') as Todo['status'],
                priority: formData.get('priority') as Todo['priority'],
                project: editModalProject,
                tags: (formData.get('tags') as string || '').split(',').map(t => t.trim()).filter(Boolean),
                assignee: formData.get('assignee') as string || undefined
              });
              closeModal();
            } catch (error) {
              console.error('Error updating todo:', error);
            } finally {
              isSubmitting = false;
            }
          }}>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  name="text"
                  required
                  value={editingTodo.text}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  rows="3"
                  value={editingTodo.description || ''}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    name="status"
                    value={editingTodo.status}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="todo">To Do</option>
                    <option value="in-progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    name="priority"
                    value={editingTodo.priority}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Project *</label>
                <ProjectAutocomplete bind:value={editModalProject} required />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  name="tags"
                  placeholder="bug, feature, ui"
                  value={editingTodo.tags.join(', ')}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
                <input
                  type="text"
                  name="assignee"
                  value={editingTodo.assignee || ''}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div class="flex justify-end gap-2 mt-6">
              <button
                type="button"
                class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                on:click={closeModal}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                class="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .kanban-board {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }

  /* Modal backdrop animation */
  .todo-modal,
  .add-todo-modal,
  .edit-todo-modal {
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
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
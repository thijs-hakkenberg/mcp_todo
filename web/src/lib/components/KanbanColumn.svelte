<script lang="ts">
  import type { Todo } from '../types/Todo';
  import TodoCard from './TodoCard.svelte';

  // Svelte 5 runes mode: use $props() instead of export let
  let {
    title,
    status,
    todos = [],
    ondrop = undefined,
    ontododblclick = undefined,
    onaddtodo = undefined
  }: {
    title: string;
    status: Todo['status'];
    todos?: Todo[];
    ondrop?: (event: { todoId: string; targetStatus: Todo['status'] }) => void;
    ontododblclick?: (todo: Todo) => void;
    onaddtodo?: (status: Todo['status']) => void;
  } = $props();

  let isDragOver = $state(false);

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragOver = true;
  }

  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;

    const todoId = event.dataTransfer?.getData('todo-id');
    if (todoId && ondrop) {
      ondrop({ todoId, targetStatus: status });
    }
  }

  function handleTodoDblClick(todo: Todo) {
    ontododblclick?.(todo);
  }

  function handleAddClick() {
    onaddtodo?.(status);
  }

  const statusColors = {
    'todo': 'bg-gray-100 border-gray-300',
    'in-progress': 'bg-blue-100 border-blue-300',
    'blocked': 'bg-red-100 border-red-300',
    'done': 'bg-green-100 border-green-300'
  };

  const statusHeaderColors = {
    'todo': 'bg-gray-200 text-gray-800',
    'in-progress': 'bg-blue-200 text-blue-800',
    'blocked': 'bg-red-200 text-red-800',
    'done': 'bg-green-200 text-green-800'
  };
</script>

<div
  class="kanban-column flex flex-col h-full rounded-lg border-2 transition-all {statusColors[status]} {isDragOver ? 'border-blue-400 shadow-lg' : ''}"
  ondragover={handleDragOver}
  ondragenter={handleDragEnter}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  <!-- Column Header -->
  <div class="px-4 py-3 rounded-t-lg {statusHeaderColors[status]}">
    <div class="flex items-center justify-between">
      <h3 class="font-semibold text-sm uppercase tracking-wide">{title}</h3>
      <span class="text-xs font-medium px-2 py-1 bg-white bg-opacity-50 rounded-full">
        {todos.length}
      </span>
    </div>
  </div>

  <!-- Add Todo Button (Top) -->
  {#if onaddtodo}
    <div class="p-3 border-b border-gray-200">
      <button
        class="add-todo-button w-full py-2 px-3 text-sm text-gray-600 hover:text-gray-900 hover:bg-white hover:bg-opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
        onclick={handleAddClick}
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        Add Todo
      </button>
    </div>
  {/if}

  <!-- Column Content -->
  <div class="flex-1 overflow-y-auto p-4 space-y-3">
    {#if todos.length === 0}
      <div class="text-center py-8 text-gray-400">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
        </svg>
        <p class="text-sm">No items</p>
      </div>
    {:else}
      {#each todos as todo (todo.id)}
        <div
          ondragstart={(e) => {
            e.dataTransfer?.setData('todo-id', todo.id);
            e.dataTransfer!.effectAllowed = 'move';
          }}
        >
          <TodoCard
            {todo}
            draggable={true}
            ondblclick={handleTodoDblClick}
          />
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .kanban-column {
    min-height: 400px;
  }

  /* Smooth scrolling for the todos container */
  .overflow-y-auto {
    scrollbar-width: thin;
    scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
  }

  .overflow-y-auto::-webkit-scrollbar {
    width: 6px;
  }

  .overflow-y-auto::-webkit-scrollbar-track {
    background: transparent;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.5);
    border-radius: 3px;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background-color: rgba(156, 163, 175, 0.7);
  }
</style>
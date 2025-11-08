<script lang="ts">
  import type { Todo } from '../types/Todo';

  // Svelte 5 runes mode: use $props() instead of export let
  let {
    todo,
    draggable = true,
    progress = 0,
    ondblclick = undefined
  }: {
    todo: Todo;
    draggable?: boolean;
    progress?: number;
    ondblclick?: (todo: Todo) => void;
  } = $props();

  function handleDblClick() {
    ondblclick?.(todo);
  }

  function formatDate(dateString: string | undefined): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function getSubtaskProgress(): string {
    const subtasks = todo.subtasks || [];
    const completed = subtasks.filter(s => s.completed).length;
    return `${completed}/${subtasks.length}`;
  }

  const priorityColors = {
    urgent: 'border-priority-urgent',
    high: 'border-priority-high',
    medium: 'border-priority-medium',
    low: 'border-priority-low'
  };

  const priorityBadgeColors = {
    urgent: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700'
  };

  const priorityLabels = {
    urgent: 'Urgent',
    high: 'High',
    medium: 'Medium',
    low: 'Low'
  };

  function hasLongDescription(): boolean {
    return (todo.description && todo.description.length > 300) || todo.description === '[See README.md]';
  }
</script>

<div
  class="todo-card bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-move border-l-4 {priorityColors[todo.priority]} {todo.status === 'done' ? 'opacity-75' : ''}"
  draggable={draggable}
  ondblclick={handleDblClick}
  role="button"
  tabindex="0"
  onkeydown={(e) => e.key === 'Enter' && handleDblClick()}
  title="Double-click to view details"
>
  <div class="flex items-start justify-between mb-2">
    <h3 class="font-medium text-gray-900 {todo.status === 'done' ? 'line-through' : ''}">
      {todo.text}
    </h3>
    <span class="text-xs px-2 py-1 rounded-full font-medium {priorityBadgeColors[todo.priority]}">
      {priorityLabels[todo.priority]}
    </span>
  </div>

  {#if todo.description}
    <p class="text-sm text-gray-600 mb-3">{todo.description}</p>
  {/if}

  {#if todo.status === 'blocked'}
    <div class="bg-red-100 border border-red-200 rounded p-2 mb-3">
      <p class="text-xs text-red-700 font-medium">Blocked</p>
    </div>
  {/if}

  {#if todo.status === 'in-progress' && progress > 0}
    <div class="mt-3 bg-gray-200 rounded-full h-2">
      <div class="bg-blue-500 h-2 rounded-full" style="width: {progress}%"></div>
    </div>
  {/if}

  <div class="flex items-center justify-between mt-3">
    <div class="flex flex-wrap gap-1">
      {#each todo.tags as tag}
        <span class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
          {tag}
        </span>
      {/each}
    </div>

    <div class="flex items-center gap-3 text-xs text-gray-500">
      {#if hasLongDescription()}
        <span class="flex items-center text-blue-600" title="Has detailed description">
          <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          Details
        </span>
      {/if}

      {#if todo.assignee}
        <span class="flex items-center">
          <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>
          </svg>
          {todo.assignee}
        </span>
      {/if}

      {#if todo.dueDate}
        <span class="flex items-center">
          <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          {formatDate(todo.dueDate)}
        </span>
      {/if}

      {#if todo.subtasks && todo.subtasks.length > 0}
        <span class="flex items-center">
          <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
          </svg>
          {getSubtaskProgress()}
        </span>
      {/if}
    </div>
  </div>
</div>
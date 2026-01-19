<script lang="ts">
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import type { Todo } from '../../types/Todo';

  let {
    todo,
    readOnly = false,
    onclose,
    onedit
  } = $props<{
    todo: Todo;
    readOnly?: boolean;
    onclose: () => void;
    onedit?: (todo: Todo) => void;
  }>();

  function renderMarkdown(text: string): string {
    try {
      const html = marked(text) as string;
      return DOMPurify.sanitize(html);
    } catch (error) {
      console.error('Error rendering markdown:', error);
      return DOMPurify.sanitize(text);
    }
  }

  function hasLongDescription(todo: Todo): boolean {
    return (todo.description?.length ?? 0) > 300 || todo.description === '[See README.md]';
  }
</script>

<div class="todo-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
  <div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
    <div class="p-6">
      <div class="flex items-start justify-between mb-4">
        <h2 class="text-xl font-bold text-gray-900">{todo.text}</h2>
        <button
          class="text-gray-400 hover:text-gray-600"
          onclick={onclose}
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      {#if todo.description}
        <div class="mb-4">
          <h3 class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            Description
            {#if hasLongDescription(todo)}
              <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Long description">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            {/if}
          </h3>
          <div class="prose prose-sm max-w-none text-gray-600">
            {@html renderMarkdown(todo.description)}
          </div>
        </div>
      {/if}

      <div class="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h3 class="text-sm font-medium text-gray-700 mb-1">Status</h3>
          <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full
            {todo.status === 'todo' ? 'bg-gray-100 text-gray-700' :
             todo.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
             todo.status === 'blocked' ? 'bg-red-100 text-red-700' :
             'bg-green-100 text-green-700'}">
            {todo.status}
          </span>
        </div>

        <div>
          <h3 class="text-sm font-medium text-gray-700 mb-1">Priority</h3>
          <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full
            {todo.priority === 'urgent' ? 'bg-red-100 text-red-700' :
             todo.priority === 'high' ? 'bg-orange-100 text-orange-700' :
             todo.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
             'bg-green-100 text-green-700'}">
            {todo.priority}
          </span>
        </div>
      </div>

      {#if todo.tags.length > 0}
        <div class="mb-4">
          <h3 class="text-sm font-medium text-gray-700 mb-1">Tags</h3>
          <div class="flex flex-wrap gap-1">
            {#each todo.tags as tag}
              <span class="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                {tag}
              </span>
            {/each}
          </div>
        </div>
      {/if}

      {#if todo.assignee}
        <div class="mb-4">
          <h3 class="text-sm font-medium text-gray-700 mb-1">Assignee</h3>
          <p class="text-gray-600">{todo.assignee}</p>
        </div>
      {/if}

      {#if todo.dueDate}
        <div class="mb-4">
          <h3 class="text-sm font-medium text-gray-700 mb-1">Due Date</h3>
          <p class="text-gray-600">
            {new Date(todo.dueDate).toLocaleDateString()}
          </p>
        </div>
      {/if}

      <div class="flex justify-end gap-2 mt-6">
        <button
          class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          onclick={onclose}
        >
          Close
        </button>
        {#if !readOnly && onedit}
          <button
            class="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            onclick={() => onedit(todo)}
          >
            Edit
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .todo-modal {
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
</style>

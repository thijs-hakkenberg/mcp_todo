<script lang="ts">
  import type { Todo, UpdateTodoInput } from '../../types/Todo';
  import ProjectAutocomplete from '../ProjectAutocomplete.svelte';

  let {
    todo,
    onclose,
    onupdate
  } = $props<{
    todo: Todo;
    onclose: () => void;
    onupdate: (id: string, updates: UpdateTodoInput) => Promise<void>;
  }>();

  let isSubmitting = $state(false);
  let project = $state(todo.project);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;

    try {
      const formData = new FormData(e.currentTarget as HTMLFormElement);
      await onupdate(todo.id, {
        text: formData.get('text') as string,
        description: formData.get('description') as string || undefined,
        status: formData.get('status') as Todo['status'],
        priority: formData.get('priority') as Todo['priority'],
        project: project,
        tags: (formData.get('tags') as string || '').split(',').map(t => t.trim()).filter(Boolean),
        assignee: formData.get('assignee') as string || undefined
      });
      onclose();
    } catch (error) {
      console.error('Error updating todo:', error);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="edit-todo-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
  <div class="bg-white rounded-lg max-w-md w-full">
    <div class="p-6">
      <h2 class="text-xl font-bold text-gray-900 mb-4">Edit Todo</h2>

      <form onsubmit={handleSubmit}>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              name="text"
              required
              value={todo.text}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              rows="3"
              value={todo.description || ''}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                name="status"
                value={todo.status}
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
                value={todo.priority}
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
            <ProjectAutocomplete bind:value={project} required />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              name="tags"
              placeholder="bug, feature, ui"
              value={todo.tags.join(', ')}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
            <input
              type="text"
              name="assignee"
              value={todo.assignee || ''}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div class="flex justify-end gap-2 mt-6">
          <button
            type="button"
            class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            onclick={onclose}
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

<style>
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
</style>

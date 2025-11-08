<script lang="ts">
  import { onMount } from 'svelte';
  import { todoStore } from '../stores/todos.svelte';
  import MultiSelectDropdown from './MultiSelectDropdown.svelte';

  // Filter options state
  let filterOptions = $state<{
    projects: string[];
    tags: string[];
    assignees: string[];
    priorities: string[];
  }>({
    projects: [],
    tags: [],
    assignees: [],
    priorities: []
  });

  // Bindable selected values for dropdowns
  let selectedProjects = $state<string[]>([]);
  let selectedTags = $state<string[]>([]);

  // Sync selected values with store
  $effect(() => {
    todoStore.setProjectsFilter(selectedProjects);
  });

  $effect(() => {
    todoStore.setTagsFilter(selectedTags);
  });

  // Derived filter arrays for chip-based filters
  const priorities = $derived(['all', ...filterOptions.priorities]);
  const assignees = $derived(['all', 'unassigned', ...filterOptions.assignees]);

  onMount(async () => {
    // Fetch filter options from API
    try {
      const response = await fetch('/api/todos/filter-options');
      const data = await response.json();

      if (data.success) {
        filterOptions = {
          projects: data.projects || [],
          tags: data.tags || [],
          assignees: data.assignees || [],
          priorities: data.priorities || []
        };
      }
    } catch (error) {
      console.error('Failed to load filter options:', error);
    }
  });

  function handlePriorityFilter(priority: string) {
    todoStore.setPriorityFilter(priority);
  }

  function handleAssigneeFilter(assignee: string) {
    todoStore.setAssigneeFilter(assignee);
  }

  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    todoStore.setSearchFilter(target.value);
  }

  function clearAllFilters() {
    todoStore.clearFilters();
    selectedProjects = [];
    selectedTags = [];
    const searchInput = document.getElementById('searchInput') as HTMLInputElement;
    if (searchInput) searchInput.value = '';
  }

  function handleIncludeCompletedToggle(event: Event) {
    const target = event.target as HTMLInputElement;
    todoStore.setIncludeCompletedFilter(target.checked);
  }

  const hasActiveFilters = $derived(
    todoStore.filters.search !== '' ||
    todoStore.filters.projects.length > 0 ||
    todoStore.filters.priority !== 'all' ||
    todoStore.filters.tags.length > 0 ||
    todoStore.filters.assignee !== 'all'
  );
</script>

<div class="border-b" style="background-color: #141416; border-color: #23252a;">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
    <div class="space-y-4">
      <!-- Search Bar -->
      <div class="flex items-center space-x-4">
        <div class="flex-1 relative">
          <input
            type="text"
            id="searchInput"
            placeholder="Search todos..."
            value={todoStore.filters.search}
            oninput={handleSearchInput}
            class="w-full px-3 py-1.5 pl-10 pr-4 border rounded text-sm focus:outline-none transition-all"
            style="
              background-color: #1e1f22;
              border-color: #23252a;
              color: #d4d5d9;
            "
            onfocus={(e) => {
              e.currentTarget.style.borderColor = '#e8724e';
              e.currentTarget.style.outline = '1px solid rgba(232, 114, 78, 0.5)';
            }}
            onblur={(e) => {
              e.currentTarget.style.borderColor = '#23252a';
              e.currentTarget.style.outline = 'none';
            }}
          />
          <svg class="absolute left-3 top-2 w-4 h-4" style="color: #606268;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
        <label class="flex items-center space-x-2 px-3 py-1.5 border rounded cursor-pointer transition-all"
          style="background-color: #1e1f22; border-color: #23252a;"
          onmouseenter={(e) => e.currentTarget.style.backgroundColor = '#232528'}
          onmouseleave={(e) => e.currentTarget.style.backgroundColor = '#1e1f22'}
        >
          <input
            type="checkbox"
            checked={todoStore.filters.includeCompleted}
            onchange={handleIncludeCompletedToggle}
            class="w-4 h-4 rounded focus:ring-0"
            style="
              appearance: none;
              border: 1.5px solid #2a2c32;
              background-color: #191a1c;
              cursor: pointer;
            "
          />
          <span class="text-sm font-medium" style="color: #d4d5d9;">Show completed</span>
        </label>
        <button
          id="clearFilters"
          onclick={clearAllFilters}
          class="px-3 py-1.5 border rounded text-sm font-medium transition-all"
          style="
            background-color: #1e1f22;
            border-color: #23252a;
            color: #d4d5d9;
          "
          onmouseenter={(e) => e.currentTarget.style.backgroundColor = '#232528'}
          onmouseleave={(e) => e.currentTarget.style.backgroundColor = '#1e1f22'}
        >
          Clear All
        </button>
      </div>

      <!-- Filter Groups -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Project Filter -->
        <div>
          <label class="block text-[10px] font-semibold uppercase tracking-wider mb-2" style="color: #7a7c82; letter-spacing: 0.05em;">Projects</label>
          <MultiSelectDropdown
            label="Projects"
            options={filterOptions.projects}
            bind:selected={selectedProjects}
            placeholder="Search projects..."
          />
        </div>

        <!-- Priority Filter -->
        <div>
          <label class="block text-[10px] font-semibold uppercase tracking-wider mb-2" style="color: #7a7c82; letter-spacing: 0.05em;">Priority</label>
          <div class="flex flex-wrap gap-1" id="priorityFilters">
            {#each priorities as priority}
              <button
                class="filter-chip px-3 py-1 text-xs rounded-full border transition-colors
                  {todoStore.filters.priority === priority
                    ? priority === 'urgent' ? 'bg-red-100 border-red-500 text-red-700'
                    : priority === 'high' ? 'bg-orange-100 border-orange-500 text-orange-700'
                    : priority === 'medium' ? 'bg-yellow-100 border-yellow-500 text-yellow-700'
                    : priority === 'low' ? 'bg-green-100 border-green-500 text-green-700'
                    : 'bg-blue-100 border-blue-500'
                    : `border-gray-300 bg-white hover:bg-gray-50 ${
                      priority === 'urgent' ? 'text-red-700 border-red-300 hover:bg-red-50'
                      : priority === 'high' ? 'text-orange-700 border-orange-300 hover:bg-orange-50'
                      : priority === 'medium' ? 'text-yellow-700 border-yellow-300 hover:bg-yellow-50'
                      : priority === 'low' ? 'text-green-700 border-green-300 hover:bg-green-50'
                      : ''
                    }`}"
                onclick={() => handlePriorityFilter(priority)}
              >
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
              </button>
            {/each}
          </div>
        </div>

        <!-- Tags Filter -->
        <div>
          <label class="block text-[10px] font-semibold uppercase tracking-wider mb-2" style="color: #7a7c82; letter-spacing: 0.05em;">Tags</label>
          <MultiSelectDropdown
            label="Tags"
            options={filterOptions.tags}
            bind:selected={selectedTags}
            placeholder="Search tags..."
          />
        </div>

        <!-- Assignee Filter -->
        <div>
          <label class="block text-[10px] font-semibold uppercase tracking-wider mb-2" style="color: #7a7c82; letter-spacing: 0.05em;">Assignee</label>
          <div class="flex flex-wrap gap-1" id="assigneeFilters">
            {#each assignees as assignee}
              <button
                class="filter-chip px-3 py-1 text-xs rounded-full border transition-colors {todoStore.filters.assignee === assignee ? 'bg-blue-100 dark:bg-blue-900 border-blue-500 text-blue-700 dark:text-blue-200' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}"
                onclick={() => handleAssigneeFilter(assignee)}
              >
                {assignee === 'all' ? 'All' : assignee === 'unassigned' ? 'Unassigned' : assignee === 'me' ? 'Me' : 'Team'}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Active Filters Display -->
      {#if hasActiveFilters}
        <div id="activeFilters">
          <div class="flex items-center space-x-2">
            <span class="text-xs text-gray-500">Active filters:</span>
            <div id="activeFiltersList" class="flex flex-wrap gap-2">
              {#if todoStore.filters.search}
                <span class="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                  Search: {todoStore.filters.search}
                  <button class="ml-1 hover:text-blue-900" onclick={() => todoStore.setSearchFilter('')}>
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                  </button>
                </span>
              {/if}

              {#each todoStore.filters.projects as project}
                <span class="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                  Project: {project}
                  <button class="ml-1 hover:text-blue-900" onclick={() => {
                    selectedProjects = selectedProjects.filter(p => p !== project);
                  }}>
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                  </button>
                </span>
              {/each}

              {#if todoStore.filters.priority !== 'all'}
                <span class="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                  Priority: {todoStore.filters.priority}
                  <button class="ml-1 hover:text-blue-900" onclick={() => todoStore.setPriorityFilter('all')}>
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                  </button>
                </span>
              {/if}

              {#each todoStore.filters.tags as tag}
                <span class="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                  Tag: {tag}
                  <button class="ml-1 hover:text-blue-900" onclick={() => {
                    selectedTags = selectedTags.filter(t => t !== tag);
                  }}>
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                  </button>
                </span>
              {/each}

              {#if todoStore.filters.assignee !== 'all'}
                <span class="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                  Assignee: {todoStore.filters.assignee}
                  <button class="ml-1 hover:text-blue-900" onclick={() => todoStore.setAssigneeFilter('all')}>
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                  </button>
                </span>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
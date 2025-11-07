<script lang="ts">
  import { onMount } from 'svelte';

  let {
    value = $bindable(''),
    required = false,
    disabled = false
  } = $props<{
    value?: string;
    required?: boolean;
    disabled?: boolean;
  }>();

  let projects = $state<string[]>([]);
  let showDropdown = $state(false);
  let inputValue = $state(value);
  let inputElement: HTMLInputElement;
  let dropdownElement: HTMLDivElement;

  // Sync inputValue with value prop
  $effect(() => {
    inputValue = value;
  });

  // Sync value prop with inputValue
  $effect(() => {
    value = inputValue;
  });

  // Filtered projects based on input
  const filteredProjects = $derived.by(() => {
    if (!inputValue) return projects;
    const searchLower = inputValue.toLowerCase();
    return projects.filter(p => p.toLowerCase().includes(searchLower));
  });

  // Load projects on mount
  onMount(async () => {
    try {
      const response = await fetch('/api/todos/filter-options');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.projects) {
          projects = data.projects;
        }
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }

    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputElement &&
        dropdownElement &&
        !inputElement.contains(event.target as Node) &&
        !dropdownElement.contains(event.target as Node)
      ) {
        showDropdown = false;
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    inputValue = target.value;
    showDropdown = true;
  }

  function handleFocus() {
    showDropdown = true;
  }

  function selectProject(project: string) {
    inputValue = project;
    value = project;
    showDropdown = false;
    inputElement?.blur();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      showDropdown = false;
    }
  }

  // Check if current value is a new project
  const isNewProject = $derived.by(() => {
    if (!inputValue) return false;
    return !projects.some(p => p.toLowerCase() === inputValue.toLowerCase());
  });
</script>

<div class="relative">
  <input
    bind:this={inputElement}
    type="text"
    value={inputValue}
    oninput={handleInput}
    onfocus={handleFocus}
    onkeydown={handleKeyDown}
    {required}
    {disabled}
    placeholder="Search or enter new project..."
    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
  />

  {#if showDropdown && (filteredProjects.length > 0 || isNewProject)}
    <div
      bind:this={dropdownElement}
      class="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
    >
      {#if filteredProjects.length > 0}
        <div class="py-1">
          <div class="px-3 py-1 text-xs font-medium text-gray-500 uppercase">
            Existing Projects
          </div>
          {#each filteredProjects as project}
            <button
              type="button"
              class="w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors"
              onclick={() => selectProject(project)}
            >
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                </svg>
                <span class="text-gray-900">{project}</span>
              </div>
            </button>
          {/each}
        </div>
      {/if}

      {#if isNewProject && inputValue.trim()}
        <div class="border-t border-gray-200 py-1">
          <button
            type="button"
            class="w-full px-3 py-2 text-left hover:bg-green-50 focus:bg-green-50 focus:outline-none transition-colors"
            onclick={() => {
              showDropdown = false;
              inputElement?.blur();
            }}
          >
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
              </svg>
              <span class="text-green-600 font-medium">Create new: "{inputValue}"</span>
            </div>
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Ensure dropdown appears above other elements */
  .z-50 {
    z-index: 50;
  }
</style>

<script lang="ts">
  import { themeStore } from '../stores/theme.svelte';

  function getIcon() {
    if (themeStore.theme === 'light') {
      return 'sun';
    } else if (themeStore.theme === 'dark') {
      return 'moon';
    } else {
      return 'system';
    }
  }

  function getLabel() {
    if (themeStore.theme === 'light') {
      return 'Light';
    } else if (themeStore.theme === 'dark') {
      return 'Dark';
    } else {
      return 'System';
    }
  }
</script>

<button
  onclick={() => themeStore.toggleTheme()}
  class="px-3 py-1.5 rounded flex items-center gap-1.5 transition-all text-sm font-medium"
  style="
    background-color: #1e1f22;
    border: 1px solid #23252a;
    color: #d4d5d9;
  "
  onmouseenter={(e) => e.currentTarget.style.backgroundColor = '#232528'}
  onmouseleave={(e) => e.currentTarget.style.backgroundColor = '#1e1f22'}
  title="Toggle theme (Light → Dark → System)"
>
  {#if getIcon() === 'sun'}
    <!-- Sun icon (Light mode) -->
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
    </svg>
  {:else if getIcon() === 'moon'}
    <!-- Moon icon (Dark mode) -->
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
    </svg>
  {:else}
    <!-- Monitor icon (System mode) -->
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
    </svg>
  {/if}
  <span class="text-sm font-medium">{getLabel()}</span>
</button>

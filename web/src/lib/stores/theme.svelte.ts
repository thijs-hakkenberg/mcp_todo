/**
 * Theme management store using Svelte 5 runes
 */

type Theme = 'light' | 'dark' | 'system';

class ThemeStore {
  theme = $state<Theme>('system');
  isDark = $state<boolean>(false);

  constructor() {
    // Initialize from localStorage or system preference
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize() {
    // Load saved preference
    const saved = localStorage.getItem('theme') as Theme | null;

    if (saved && (saved === 'light' || saved === 'dark' || saved === 'system')) {
      this.theme = saved;
    }

    // Apply theme
    this.applyTheme();

    // Listen for system theme changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', () => {
        if (this.theme === 'system') {
          this.applyTheme();
        }
      });
    }
  }

  private applyTheme() {
    let isDark = false;

    if (this.theme === 'dark') {
      isDark = true;
    } else if (this.theme === 'light') {
      isDark = false;
    } else {
      // system
      if (window.matchMedia) {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    }

    this.isDark = isDark;

    // Apply to document
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  setTheme(newTheme: Theme) {
    this.theme = newTheme;
    localStorage.setItem('theme', newTheme);
    this.applyTheme();
  }

  toggleTheme() {
    if (this.theme === 'light') {
      this.setTheme('dark');
    } else if (this.theme === 'dark') {
      this.setTheme('system');
    } else {
      this.setTheme('light');
    }
  }
}

export const themeStore = new ThemeStore();

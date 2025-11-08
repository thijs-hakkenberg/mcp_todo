import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
  plugins: [
    svelte({
      hot: false,
      compilerOptions: {
        // Svelte 5 auto-detects runes, but we can be explicit
        runes: true
      }
    }),
    svelteTesting()
  ],
  // Browser resolution conditions for Svelte 5 runes in tests
  resolve: process.env.VITEST ? {
    conditions: ['browser']
  } : undefined,
  test: {
    include: ['src/**/*.test.ts'],
    // Exclude component tests due to Svelte 5 runes incompatibility with jsdom
    // See: docs/TESTING_LIMITATIONS.md
    exclude: [
      'node_modules/**',
      'src/lib/components/**/*.test.ts',
      'src/lib/components/**/*.svelte.test.ts'
    ],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/setupTests.ts',
        'src/lib/components/**', // Exclude components from coverage (no tests)
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  },
  server: {
    port: 31415,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true
      }
    }
  }
})

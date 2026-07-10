import { defineConfig, defineProject } from 'vitest/config';

export default defineConfig({
  test: {
    // Global configurations shared across all projects
    globals: true,
    setupFiles: ['./test/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },

    // Modern replacement for defineWorkspace
    projects: [
      defineProject({
        test: {
          name: 'frontend',
          include: ['plugins/frontend/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
        },
      }),
      defineProject({
        test: {
          name: 'backend',
          include: ['plugins/backend/**/*.test.{ts,tsx}', 'packages/**/*.test.{ts,tsx}'],
          environment: 'node',
        },
      }),
    ],
  },
});

import { defineConfig, defineProject } from 'vitest/config';

export default defineConfig({
  // redirects cache out of node_modules
  cacheDir: '.vitest-cache',
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },

    // Modern replacement for defineWorkspace
    projects: [
      defineProject({
        test: {
          name: 'frontend',
          globals: true,
          setupFiles: ['./test/vitest.setup.ts'],
          include: [
            'packages/app/src/**/*.test.{ts,tsx}',
            'plugins/frontend/**/*.test.{ts,tsx}',
          ],
          environment: 'jsdom',
        },
      }),
      defineProject({
        test: {
          name: 'backend',
          globals: true,
          setupFiles: ['./test/vitest.setup.ts'],
          include: [
            'packages/backend/src/**/*.test.{ts,tsx}',
            'plugins/backend/**/*.test.{ts,tsx}',
          ],
          environment: 'node',
        },
      }),
    ],
  },
});

import { defineConfig, defineProject } from 'vitest/config';

export default defineConfig({
  cacheDir: '.vitest-cache',
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    projects: [
      defineProject({
        test: {
          name: 'frontend',
          globals: true,
          setupFiles: ['./test/vitest.setup.ts'],
          include: [
            'apps/backstage/src/**/*.test.{ts,tsx}',
            'plugins/agents/**/frontend/**/*.test.{ts,tsx}',
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
            'plugins/agents/**/backend/**/*.test.{ts,tsx}',
            'plugins/core/**/*.test.{ts,tsx}',
            'plugins/tools/**/*.test.{ts,tsx}',
          ],
          environment: 'node',
        },
      }),
    ],
  },
});

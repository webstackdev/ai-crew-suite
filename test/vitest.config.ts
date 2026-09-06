/*
 * Copyright 2026 Webstack Builders, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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

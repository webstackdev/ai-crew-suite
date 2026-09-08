/*
 * Copyright 2026 The AI Crew Suite Authors
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
import { defineConfig } from 'vitest/config';
import { getWorkspaceContext } from '../../../utils/workspace.js'; 
import path from 'node:path';

const context = getWorkspaceContext();
const repoRoot = context.repoRoot;

const setupFilePath = path.resolve(repoRoot, 'packages/cli/dist/bin/commands/test-unit/lib/setup.js');
const projectName = path.relative(repoRoot, context.packageDir).replace(/\//g, '-') || 'root-suite';

export default defineConfig({
  test: {
    name: projectName,
    globals: true,
    environment: context.isBrowser ? 'jsdom' : 'node',
    passWithNoTests: true,
    setupFiles: [setupFilePath],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e-tests/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});

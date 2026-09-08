/**
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
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This Vitest config is only for the @ai-crew-suite/cli package. It
 * avoids a chicken-and-egg problem of running tests on the test:unit
 * Commander task during development of that command.
 */
const __filename = fileURLToPath(import.meta.url);
const currentDir = path.dirname(__filename);

export default defineConfig({
  test: {
    name: 'ai-crew-suite-cli-core',
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Use path aliases to ensure that '.js' file extensions in source
    // imports map natively to real source '.ts' files during live test runs
    alias: {
      '../../utils/workspace.js': path.resolve(currentDir, 'src/bin/utils/workspace.ts'),
      '../utils/workspace.js': path.resolve(currentDir, 'src/bin/utils/workspace.ts'),
    },
  },
});

/*
 * Copyright 2026 The AI Crew Suite Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://apache.org
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { defineConfig } from 'vitest/config';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export type VitestConfigShape = ReturnType<typeof defineConfig>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SETUP_FILE_PATH = path.resolve(__dirname, './setup.js');

export const baseBackendConfig: VitestConfigShape = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    setupFiles: [SETUP_FILE_PATH],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});

export const baseFrontendConfig: VitestConfigShape = defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
    setupFiles: [SETUP_FILE_PATH],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});

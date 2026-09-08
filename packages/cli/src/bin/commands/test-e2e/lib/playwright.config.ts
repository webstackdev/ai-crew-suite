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
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findRepoRoot } from '../../../utils/workspace.js';

const __filename = fileURLToPath(import.meta.url);
const currentDir = path.dirname(__filename);
const repoRoot = findRepoRoot(currentDir);

const APP_HOST = process.env['PLAYWRIGHT_APP_HOST'] || 'http://localhost';
const APP_PORT = process.env['PLAYWRIGHT_APP_PORT'] || '3000';

const BACKEND_HOST = process.env['PLAYWRIGHT_BACKEND_HOST'] || 'http://localhost';
const BACKEND_PORT = process.env['PLAYWRIGHT_BACKEND_PORT'] || '7007';

const appUrlInstance = new URL(APP_HOST);
appUrlInstance.port = APP_PORT;
const APP_URL = appUrlInstance.toString();

const backendUrlInstance = new URL(BACKEND_HOST);
backendUrlInstance.port = BACKEND_PORT;
backendUrlInstance.pathname = '/api/health';
const BACKEND_HEALTH_URL = backendUrlInstance.toString();

export default defineConfig({
  testDir: repoRoot, // Scan the entire monorepo workspace tree dynamically
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 2 : '50%',
  reporter: process.env['CI'] ? [['github'], ['html']] : 'html',

  testMatch: '**/src/**/*.e2e.test.ts',

  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/dist-types/**',
    '**/coverage/**',
    '**/test/**',
    '**/*.unit.test.ts'
  ],

  use: {
    baseURL: APP_URL,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 30000, 
    navigationTimeout: 30000,
    trace: 'retain-on-failure', 
    headless: true,
    screenshot: 'only-on-failure',
    // Cache the authentication states securely inside a localized temporary directory inside the CLI package
    storageState: path.resolve(repoRoot, 'node_modules/.cache/playwright/.auth/login.json'),
  },

  projects: [
    {
      name: 'setup',
      testMatch: /playwright\/.*\.setup\.ts/ 
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: [
        'apps/**/*.e2e.test.ts',
        'plugins/**/*.e2e.test.ts'
      ],
      dependencies: ['setup'],
    },
  ],

  webServer: [
    {
      command: 'yarn start',
      url: APP_URL,
      reuseExistingServer: !process.env['CI'],
      timeout: 180 * 1000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'yarn start-backend',
      url: BACKEND_HEALTH_URL,
      reuseExistingServer: !process.env['CI'],
      timeout: 180 * 1000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});

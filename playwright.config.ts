/*
 * Copyright 2021 Larder Software Limited
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
import path from 'path';

export default defineConfig({
  // Global directory to find setup files and orchestrate multi-plugin tests
  testDir: path.resolve(__dirname),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0, // Increased to 2 for CI stability (Backstage apps can be slow to boot)
  workers: process.env.CI ? 2 : '50%', // Scales workers dynamically based on local CPU cores
  reporter: process.env.CI ? [['github'], ['html']] : 'html', // Adds inline GitHub Actions annotations
  testMatch: '**/e2e/**/*.test.ts',
  testIgnore: ['**/src/**', '**/node_modules/**', '**/cypress/**'],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    viewport: { width: 1440, height: 900 },
    actionTimeout: 30000, // Reduced from 60s; 30s is standard to avoid hanging unnecessarily long
    navigationTimeout: 30000,
    trace: 'retain-on-failure', // Keeps traces for failed tests to make debugging broken CI runs easier
    headless: true,
    screenshot: 'only-on-failure',
    // Uses a path relative to the root config directory for deterministic state sharing
    storageState: path.resolve(__dirname, 'playwright/.auth/login.json'),
  },

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Look for tests globally under packages/ plugins using the global testMatch filter
      testDir: path.resolve(__dirname, 'packages'),
      dependencies: ['setup'],
    },
  ],

  webServer: [
    {
      command: 'yarn start',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 180 * 1000, // Backstage frontend compiling can take up to 3 minutes on slow CI runners
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'yarn start-backend',
      url: 'http://localhost:7007/api/health', // Targets the actual health endpoint of Backstage backend
      reuseExistingServer: !process.env.CI,
      timeout: 180 * 1000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});

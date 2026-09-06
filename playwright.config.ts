/**
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
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: path.resolve(__dirname),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : '50%',
  reporter: process.env.CI ? [['github'], ['html']] : 'html',

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
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    viewport: { width: 1440, height: 900 },
    actionTimeout: 30000, 
    navigationTimeout: 30000,
    trace: 'retain-on-failure', 
    headless: true,
    screenshot: 'only-on-failure',
    storageState: path.resolve(__dirname, 'playwright/.auth/login.json'),
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
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 180 * 1000, 
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'yarn start-backend',
      url: 'http://localhost:7007/api/health', 
      reuseExistingServer: !process.env.CI,
      timeout: 180 * 1000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});

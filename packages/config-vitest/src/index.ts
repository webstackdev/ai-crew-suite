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
const moduleDir = path.dirname(__filename);

/** Resolve the setup file relative to this shared package's built output location */
const SETUP_FILE_PATH = path.resolve(moduleDir, './setup.js');

/**
 * Dynamically constructs a project configuration based on the relative folder path.
 * Used by the root vitest.workspace.ts orchestrator.
 */
export function createWorkspaceProjectConfig(projectPath: string): VitestConfigShape {
  /** Normalize windows backslashes to forward slashes */
  const normalizedPath = projectPath.replace(/\\/g, '/');

  /** Rules determining if the context belongs to a browser/frontend environment */
  const isAppFrontend = normalizedPath.endsWith('packages/app');
  const isAgentFrontend = normalizedPath.includes('plugins/agents/') && normalizedPath.endsWith('/frontend');

  const environment = (isAppFrontend || isAgentFrontend) ? 'jsdom' : 'node';

  /** Extract a clean project name from the path for the reporter UI (e.g., "plugins-agents-my-plugin-frontend") */
  const projectName = normalizedPath.replace(/^\.\//, '').replace(/\//g, '-');

  return defineConfig({
    test: {
      name: projectName,
      globals: true,
      environment,
      passWithNoTests: true,
      setupFiles: [SETUP_FILE_PATH],
      /** Explicitly ignore any playwright test files contained inside e2e-tests paths */
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
}

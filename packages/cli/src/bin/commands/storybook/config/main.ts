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
// 📂 packages/cli/src/bin/commands/storybook/config/main.ts
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import path from 'node:path';
import type { StorybookConfig } from '@storybook/react-vite';
import tsconfigPaths from 'vite-plugin-tsconfig-paths';

const repoRoot = process.env['AI_CREW_SUITE_REPO_ROOT'];

if (!repoRoot) {
  throw new Error('❌ Critical Config Failure: AI_CREW_SUITE_REPO_ROOT environment variable is not set.');
}

function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const config: StorybookConfig = {
  stories: [
    path.resolve(repoRoot, 'plugins/**/*.stories.@(js|jsx|mjs|ts|tsx)')
  ],
  addons: [getAbsolutePath("@storybook/addon-links"), getAbsolutePath("@storybook/addon-docs")],
  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {},
  },
  viteFinal: async (viteConfig) => {
    const serverConfig = viteConfig.server || {};
    const fsConfig = serverConfig.fs || {};
    const currentAllowList = Array.isArray(fsConfig.allow) ? fsConfig.allow : [];
    const currentPlugins = Array.isArray(viteConfig.plugins) ? viteConfig.plugins : [];

    const tsconfigOptions = {
      projects: [
        path.resolve(repoRoot, 'tsconfig.json')
      ]
    } as unknown as Record<string, unknown>;

    viteConfig.plugins = [
      ...currentPlugins,
      tsconfigPaths(tsconfigOptions)
    ];

    viteConfig.server = {
      ...serverConfig,
      fs: {
        ...fsConfig,
        allow: [
          ...currentAllowList,
          repoRoot
        ]
      }
    };

    return viteConfig;
  }
};

export default config;

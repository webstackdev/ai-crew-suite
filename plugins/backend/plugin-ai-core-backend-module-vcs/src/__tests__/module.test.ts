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
import { startTestBackend } from '@backstage/backend-test-utils';
import { mockServices } from '@backstage/backend-test-utils';
import { createBackendPlugin } from '@backstage/backend-plugin-api';
import { toolExtensionPoint } from '@webstackbuilders/plugin-ai-core-node';
import { describe, expect, it, vi } from 'vitest';
import { aiCoreBackendModuleVcs } from '../module';

describe('aiCoreBackendModuleVcs', () => {
  it('should initialize successfully with a valid provider configuration', async () => {
    const configData = {
      ai: {
        integrations: {
          vcs: {
            provider: 'github',
          },
        },
      },
      integrations: {
        github: [
          {
            host: 'github.com',
            token: 'mock-token',
          },
        ],
      },
    };

    const mockToolExtensionPoint = {
      addTool: vi.fn(),
    };

    const mockAiCorePlugin = createBackendPlugin({
      pluginId: 'ai-core',
      register(env) {
        // Register the missing tool registry extension point expected by the VCS module dependency array
        env.registerExtensionPoint(toolExtensionPoint, mockToolExtensionPoint);
        env.registerInit({
          deps: {},
          async init() {},
        });
      },
    });

    // Spin up an isolated backend test harness with valid backend feature blocks
    await expect(
      startTestBackend({
        features: [
          mockAiCorePlugin, // The main plugin host container
          aiCoreBackendModuleVcs, // Our VCS module attaching to it
          mockServices.rootConfig.factory({ data: configData }),
          mockServices.logger.factory(),
          mockServices.urlReader.factory(),
        ],
      }),
    ).resolves.toBeDefined();
  });
});

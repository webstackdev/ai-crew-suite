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
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import { createBackendPlugin } from '@backstage/backend-plugin-api';
import { runtimeStoreExtensionPoint } from '@webstackbuilders/plugin-ai-core-node';
import { describe, expect, it, vi } from 'vitest';
import { aiCoreBackendModuleRuntimeStore } from '../module';
import { SqlAgentRuntimeStore } from '../service/SqlAgentRuntimeStore';

describe('aiCoreBackendModuleRuntimeStore', () => {
  it('applies migrations and registers SQL-backed runtime stores by default', async () => {
    const runtimeStores = {
      setSessionStore: vi.fn(),
      setCheckpointStore: vi.fn(),
      setRunStore: vi.fn(),
      setArtifactSink: vi.fn(),
      setAuditLogSink: vi.fn(),
    };

    // Host stub standing in for plugin-ai-core-backend.
    const mockAiCorePlugin = createBackendPlugin({
      pluginId: 'ai-core',
      register(env) {
        env.registerExtensionPoint(runtimeStoreExtensionPoint, runtimeStores);
        env.registerInit({
          deps: {},
          async init() {
            // Keep this block execution footprint empty as it is just a host stub
          },
        });
      },
    });

    await expect(
      startTestBackend({
        features: [
          mockAiCorePlugin,
          aiCoreBackendModuleRuntimeStore,
          mockServices.rootConfig.factory({ data: {} }),
          mockServices.logger.factory(),
          mockServices.database.factory(),
        ],
      }),
    ).resolves.toBeDefined();

    expect(runtimeStores.setSessionStore).toHaveBeenCalledWith(
      expect.any(SqlAgentRuntimeStore),
    );
    expect(runtimeStores.setCheckpointStore).toHaveBeenCalledWith(
      expect.any(SqlAgentRuntimeStore),
    );
    expect(runtimeStores.setRunStore).toHaveBeenCalledWith(
      expect.any(SqlAgentRuntimeStore),
    );
    expect(runtimeStores.setArtifactSink).toHaveBeenCalledWith(
      expect.any(SqlAgentRuntimeStore),
    );
    expect(runtimeStores.setAuditLogSink).toHaveBeenCalledWith(
      expect.any(SqlAgentRuntimeStore),
    );
  });
});

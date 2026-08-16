import { createBackendModule, createBackendPlugin } from '@backstage/backend-plugin-api';
import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
import {
  ToolExtensionPoint,
  kubernetesDiagnosticsDriversExtensionPoint,
  toolExtensionPoint,
} from '@webstackbuilders/plugin-ai-core-node';
import { describe, expect, it, vi } from 'vitest';
import { aiCoreBackendModuleKubernetes } from '../module';

const configData = {
  ai: { integrations: { kubernetes: { provider: 'backstage' } } },
};

const createHostPlugin = (tools: { addTool: ReturnType<typeof vi.fn> }) =>
  createBackendPlugin({
    pluginId: 'ai-core',
    register(env) {
      env.registerExtensionPoint(
        toolExtensionPoint,
        tools as unknown as ToolExtensionPoint,
      );
      env.registerInit({ deps: {}, async init() {} });
    },
  });

const createMockDriverModule = (providerId: string) =>
  createBackendModule({
    pluginId: 'ai-core',
    moduleId: 'kubernetes-diagnostics-mock',
    register(env) {
      env.registerInit({
        deps: { registry: kubernetesDiagnosticsDriversExtensionPoint },
        async init({ registry }) {
          registry.registerDriver({
            providerId,
            resolveWorkloads: vi.fn(),
            getWorkloadSnapshot: vi.fn(),
            getPodSnapshot: vi.fn(),
            getPodLogs: vi.fn(),
            listWorkloadEvents: vi.fn(),
            getWorkloadTimeline: vi.fn(),
          });
        },
      });
    },
  });

describe('aiCoreBackendModuleKubernetes', () => {
  it('registers diagnostics tools once a driver is registered', async () => {
    const tools = { addTool: vi.fn() };

    await startTestBackend({
      features: [
        createHostPlugin(tools),
        aiCoreBackendModuleKubernetes,
        createMockDriverModule('backstage'),
        mockServices.rootConfig.factory({ data: configData }),
        mockServices.logger.factory(),
      ],
    });

    expect(tools.addTool.mock.calls.map(([tool]) => tool.id)).toEqual([
      'kubernetes.workload.resolve',
      'kubernetes.workload.get_snapshot',
      'kubernetes.pod.get_snapshot',
      'kubernetes.pod.get_logs',
      'kubernetes.workload.list_events',
      'kubernetes.workload.get_timeline',
    ]);
  });

  it('fails when the configured driver was never registered', async () => {
    await expect(
      startTestBackend({
        features: [
          createHostPlugin({ addTool: vi.fn() }),
          aiCoreBackendModuleKubernetes,
          createMockDriverModule('other'),
          mockServices.rootConfig.factory({ data: configData }),
          mockServices.logger.factory(),
        ],
      }),
    ).rejects.toThrow(
      /No Kubernetes diagnostics driver registered for identifier 'backstage'/,
    );
  });
});

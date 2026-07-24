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
// plugins/backend/plugin-ai-core-backend-module-cloud-providers-kubernetes/src/providers/KubernetesDriver.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigReader } from '@backstage/config';
import { KubernetesDriver } from '../KubernetesDriver';
import { CoreV1Api } from '@kubernetes/client-node';

// Automatically mock the official Kubernetes client node module
vi.mock('@kubernetes/client-node', async (importOriginal) => {
  const original = await importOriginal<typeof import('@kubernetes/client-node')>();
  return {
    ...original,
    CoreV1Api: vi.fn().mockImplementation(() => ({
      listNamespacedPod: vi.fn(),
    })),
  };
});

describe('KubernetesDriver Configuration Mapping Suite', () => {
  const mockLogger = { debug: vi.fn(), error: vi.fn() };
  
  // Scaffold a valid root config mimicking an authentic app-config.yaml environment
  const mockRootConfig = new ConfigReader({
    kubernetes: {
      clusters: [
        {
          name: 'production-cluster',
          url: 'https://corp.internal',
          serviceAccountToken: 'mock-sa-token-abc-123',
        },
      ],
    },
  });

  let driver: KubernetesDriver;

  beforeEach(() => {
    driver = new KubernetesDriver({
      logger: mockLogger,
      rootConfig: mockRootConfig,
      config: { targetNamespaces: ['production-namespace'] },
    });
    vi.restoreAllMocks();
  });

  it('correctly extracts clusters from global config and normalizes raw pod data into standard contracts', async () => {
    // Instantiate a dedicated mock handle mirroring the internal list method
    const mockListNamespacedPod = vi.fn().mockResolvedValue({
      items: [
        {
          metadata: { name: 'payment-service-deployment-xyz' },
          status: {
            phase: 'Running',
            containerStatuses: [
              {
                state: {
                  waiting: { reason: 'ImagePullBackOff' },
                },
              },
            ],
          },
          spec: {
            containers: [{ image: 'internal-registry.io/payment:v1.2.0' }],
          },
        },
      ],
    });

    // Wire up our custom spy handle to catch the class instantiation routine
    vi.mocked(CoreV1Api).mockImplementation(() => ({
      listNamespacedPod: mockListNamespacedPod,
    } as any));

    const workloads = await driver.kubernetesWorkloads({ namespace: 'production-namespace' });

    // Validate that the correct cluster context list routine was executed
    expect(mockListNamespacedPod).toHaveBeenCalledWith({ namespace: 'production-namespace' });
  
    // Verify structural data translation integrity matches agentic domain models
    expect(workloads).toHaveLength(1);
    expect(workloads[0]).toEqual({
      name: 'payment-service-deployment-xyz',
      kind: 'Pod',
      namespace: 'production-namespace',
      status: 'ImagePullBackOff',
      replicas: 1,
      images: ['internal-registry.io/payment:v1.2.0'],
    });
  });

  it('surfaces native SDK connection rejections transparently up the runtime stack', async () => {
    const mockRejectCall = vi.fn().mockRejectedValue(new Error('KubeAPI Connection Timeout'));
    vi.mocked(CoreV1Api).mockImplementation(() => ({
      listNamespacedPod: mockRejectCall,
    } as any));

    await expect(
      driver.kubernetesWorkloads({ namespace: 'production-namespace' })
    ).rejects.toThrow(/KubeAPI Connection Timeout/);
  });
});

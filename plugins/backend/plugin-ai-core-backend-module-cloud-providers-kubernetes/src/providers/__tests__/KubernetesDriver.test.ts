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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockServices } from '@backstage/backend-test-utils';
import { KubernetesDriver } from '../KubernetesDriver';

describe('KubernetesDriver Boundary Evaluation', () => {
  const logger = mockServices.logger.mock();
  let driver: KubernetesDriver;

  beforeEach(() => {
    driver = new KubernetesDriver({
      logger,
      config: { targetNamespaces: ['production'] },
    });
    vi.restoreAllMocks();
  });

  it('correctly maps raw OOMKilled container payload fields to standard domain summary contracts', async () => {
    // Structural Interceptor Mock satisfying global fetch pipeline
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            metadata: { name: 'auth-service-pod-xyz' },
            status: {
              phase: 'Running',
              containerStatuses: [
                {
                  state: {
                    waiting: { reason: 'OOMKilled' },
                  },
                },
              ],
            },
            spec: {
              containers: [{ image: 'node:20-alpine' }],
            },
          },
        ],
      }),
    } as Response);

    const workloads = await driver.kubernetesWorkloads({ namespace: 'production' });

    expect(workloads).toHaveLength(1);
    expect(workloads[0]).toEqual({
      name: 'auth-service-pod-xyz',
      kind: 'Pod',
      namespace: 'production',
      status: 'OOMKilled', // Successfully extracted and translated from deep container hooks
      replicas: 1,
      images: ['node:20-alpine'],
    });
  });

  it('safely surfaces underlying network API connection rejections up the runtime chain', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    await expect(driver.kubernetesWorkloads({ namespace: 'production' })).rejects.toThrow(
      /K8s API returned non-OK status: 500/
    );
  });
});

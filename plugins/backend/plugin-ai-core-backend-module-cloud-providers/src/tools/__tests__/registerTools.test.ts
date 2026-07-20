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
import { describe, expect, it, vi } from 'vitest';
import { createCloudProviderTools } from '../registerTools';
import { CloudProviderDriver } from '../../providers';

const createMockDriver = (overrides: Partial<CloudProviderDriver> = {}): CloudProviderDriver => ({
  providerId: 'mock',
  lookupAccount: vi.fn().mockResolvedValue(undefined),
  lookupResource: vi.fn().mockResolvedValue([]),
  resourceDependencies: vi.fn().mockResolvedValue({ resourceId: 'r1', dependsOn: [], dependedBy: [] }),
  kubernetesWorkloads: vi.fn().mockResolvedValue([]),
  ...overrides,
});

const createMockLogger = () => ({
  debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn().mockReturnThis(),
});

const ctx = {
  logger: createMockLogger() as never,
  identity: 'test-user',
  runId: 'test-run',
  signal: new AbortController().signal,
};

describe('createCloudProviderTools', () => {
  it('registers the expected stable tool IDs', () => {
    const tools = createCloudProviderTools({ driver: createMockDriver(), logger: createMockLogger() as never });
    expect(tools.map(t => t.id)).toEqual([
      'cloud.account.lookup',
      'cloud.resource.lookup',
      'cloud.resource.dependencies',
      'cloud.kubernetes.workloads',
    ]);
  });

  it('marks all tools as read', () => {
    const tools = createCloudProviderTools({ driver: createMockDriver(), logger: createMockLogger() as never });
    for (const tool of tools) {
      expect(tool.effect).toBe('read');
    }
  });

  it('cloud.account.lookup delegates to driver', async () => {
    const driver = createMockDriver();
    const tools = createCloudProviderTools({ driver, logger: createMockLogger() as never });
    const tool = tools.find(t => t.id === 'cloud.account.lookup')!;
    await tool.invoke({ accountId: '123' }, ctx);
    expect(driver.lookupAccount).toHaveBeenCalledWith({ accountId: '123' });
  });
});

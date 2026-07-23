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
import { CloudProviderDriver } from '@webstackbuilders/plugin-ai-core-node';
import { createCloudProviderTools } from '../registerTools';

const createLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
});

describe('createCloudProviderTools', () => {
  let mockDriver: CloudProviderDriver;
  const logger = createLogger() as any;

  beforeEach(() => {
    mockDriver = {
      providerId: 'aws-test',
      lookupAccount: vi.fn(),
      lookupResource: vi.fn(),
      resourceDependencies: vi.fn(),
      kubernetesWorkloads: vi.fn(),
    };
  });

  it('should create exactly 4 specialized system tools mapping directly to driver capabilities', () => {
    const tools = createCloudProviderTools({ driver: mockDriver, logger });
    expect(tools).toHaveLength(4);

    const names = tools.map(t => t.name);
    expect(names).toContain('aws-test_lookup_account');
    expect(names).toContain('aws-test_lookup_resource');
    expect(names).toContain('aws-test_resource_dependencies');
    expect(names).toContain('aws-test_kubernetes_workloads');
  });

  it('should invoke lookupAccount safely inside the tool execute matrix closure block', async () => {
    const mockSummary = { id: '12345', provider: 'aws-test', name: 'dev-environment' };
    vi.mocked(mockDriver.lookupAccount).mockResolvedValueOnce(mockSummary);

    const tools = createCloudProviderTools({ driver: mockDriver, logger });
    const accountTool = tools.find(t => t.name === 'aws-test_lookup_account');

    const result = await accountTool.execute({ accountId: '12345' });
    expect(mockDriver.lookupAccount).toHaveBeenCalledWith({ accountId: '12345' });
    expect(result).toEqual({ account: mockSummary });
  });

  it('should capture driver runtime execution rejections and transform them into generic tool payload error properties', async () => {
    vi.mocked(mockDriver.kubernetesWorkloads).mockRejectedValueOnce(new Error('Cluster connection timeout'));

    const tools = createCloudProviderTools({ driver: mockDriver, logger });
    const k8sTool = tools.find(t => t.name === 'aws-test_kubernetes_workloads');

    const result = await k8sTool.execute({ namespace: 'kube-system' });
    expect(result).toEqual({ error: 'Cluster connection timeout' });
  });
});

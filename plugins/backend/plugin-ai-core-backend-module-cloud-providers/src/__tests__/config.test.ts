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
// plugins/backend/plugin-ai-core-backend-module-cloud-providers/src/__tests__/config.test.ts
import { describe, it, expect } from 'vitest';
import { ConfigReader } from '@backstage/config';
import { readCloudProvidersConfig } from '../config';

describe('readCloudProvidersConfig', () => {
  it('should successfully parse valid configuration topologies', () => {
    const mockConfig = new ConfigReader({
      ai: {
        integrations: {
          cloudProviders: {
            defaultProvider: 'kubernetes',
            providers: {
              kubernetes: {
                targetNamespaces: ['development', 'production'],
              },
              aws: {
                region: 'us-west-2',
              },
            },
          },
        },
      },
    });

    const parsed = readCloudProvidersConfig(mockConfig);
    expect(parsed.defaultProvider).toBe('kubernetes');
    expect(parsed.providers.kubernetes?.targetNamespaces).toEqual(['development', 'production']);
    expect(parsed.providers.aws?.region).toBe('us-west-2');
  });

  it('should throw an explicit error if cloudProviders block is completely absent', () => {
    const mockConfig = new ConfigReader({});
    expect(() => readCloudProvidersConfig(mockConfig)).toThrow(
      /Cloud providers module requires ai.integrations.cloudProviders configuration to be set/
    );
  });

  it('should throw an explicit error if defaultProvider is missing', () => {
    const mockConfig = new ConfigReader({
      ai: {
        integrations: {
          cloudProviders: {
            providers: {
              aws: { region: 'us-east-1' },
            },
          },
        },
      },
    });
    expect(() => readCloudProvidersConfig(mockConfig)).toThrow(
      /Cloud providers module requires ai.integrations.cloudProviders.defaultProvider to be set/
    );
  });
});

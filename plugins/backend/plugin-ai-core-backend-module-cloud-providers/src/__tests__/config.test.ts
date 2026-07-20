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
import { describe, expect, it } from 'vitest';
import { ConfigReader } from '@backstage/config';
import { readCloudProvidersConfig } from '../config';

describe('readCloudProvidersConfig', () => {
  it('reads a valid aws config', () => {
    const config = new ConfigReader({
      ai: { integrations: { cloudProviders: { defaultProvider: 'aws', aws: { region: 'us-east-1' } } } },
    });
    const result = readCloudProvidersConfig(config);
    expect(result.defaultProvider).toBe('aws');
    expect(result.providers.aws?.region).toBe('us-east-1');
  });

  it('throws when config is missing', () => {
    expect(() => readCloudProvidersConfig(new ConfigReader({}))).toThrow(
      /ai\.integrations\.cloudProviders configuration to be set/,
    );
  });

  it('throws when defaultProvider is missing', () => {
    const config = new ConfigReader({ ai: { integrations: { cloudProviders: {} } } });
    expect(() => readCloudProvidersConfig(config)).toThrow(/defaultProvider to be set/);
  });

  it('throws when defaultProvider is unsupported', () => {
    const config = new ConfigReader({
      ai: { integrations: { cloudProviders: { defaultProvider: 'bad' } } },
    });
    expect(() => readCloudProvidersConfig(config)).toThrow(/Unsupported cloud provider/);
  });
});

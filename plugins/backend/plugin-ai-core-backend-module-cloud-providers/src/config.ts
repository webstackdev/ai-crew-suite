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
import { Config } from '@backstage/config';

export type CloudProviderId = 'aws' | 'azure' | 'gcp';

export type ProviderConnectionConfig = {
  region?: string;
};

export type CloudProvidersConfig = {
  defaultProvider: CloudProviderId;
  providers: Partial<Record<CloudProviderId, ProviderConnectionConfig>>;
};

const CLOUD_PROVIDERS: readonly CloudProviderId[] = ['aws', 'azure', 'gcp'];

const isCloudProvider = (value: unknown): value is CloudProviderId =>
  typeof value === 'string' && (CLOUD_PROVIDERS as readonly string[]).includes(value);

export const readCloudProvidersConfig = (config: Config): CloudProvidersConfig => {
  const cloudConfig = config.getOptionalConfig('ai.integrations.cloudProviders');
  if (!cloudConfig) {
    throw new Error(
      'Cloud providers module requires ai.integrations.cloudProviders configuration to be set',
    );
  }

  const defaultProvider = cloudConfig.getOptionalString('defaultProvider');
  if (!defaultProvider) {
    throw new Error('Cloud providers module requires ai.integrations.cloudProviders.defaultProvider to be set');
  }
  if (!isCloudProvider(defaultProvider)) {
    throw new Error(`Unsupported cloud provider '${defaultProvider}'. Supported: ${CLOUD_PROVIDERS.join(', ')}`);
  }

  const providers: Partial<Record<CloudProviderId, ProviderConnectionConfig>> = {};
  for (const candidate of CLOUD_PROVIDERS) {
    const providerConfig = cloudConfig.getOptionalConfig(candidate);
    if (providerConfig) {
      providers[candidate] = { region: providerConfig.getOptionalString('region') };
    }
  }

  return { defaultProvider, providers };
};

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

export type VcsProviderId = 'github' | 'gitlab' | 'bitbucket' | 'azuredevops';

export type VcsProviderConfig = {
  host?: string;
  apiBaseUrl?: string;
};

export type VcsConfig = {
  provider: VcsProviderId;
  providers: Partial<Record<VcsProviderId, VcsProviderConfig>>;
};

const SUPPORTED_PROVIDERS: readonly VcsProviderId[] = [
  'github',
  'gitlab',
  'bitbucket',
  'azuredevops',
];

const isVcsProviderId = (value: unknown): value is VcsProviderId =>
  typeof value === 'string' &&
  (SUPPORTED_PROVIDERS as readonly string[]).includes(value);

export const readVcsConfig = (config: Config): VcsConfig => {
  const vcsConfig = config.getOptionalConfig('ai.integrations.vcs');

  if (!vcsConfig) {
    throw new Error(
      'VCS module requires ai.integrations.vcs configuration to be set',
    );
  }

  const provider = vcsConfig.getOptionalString('provider');

  if (!provider) {
    throw new Error(
      'VCS module requires ai.integrations.vcs.provider to be set',
    );
  }

  if (!isVcsProviderId(provider)) {
    throw new Error(
      `VCS module received unsupported provider '${provider}'. Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`,
    );
  }

  const providers: Partial<Record<VcsProviderId, VcsProviderConfig>> = {};

  for (const candidate of SUPPORTED_PROVIDERS) {
    const providerConfig = vcsConfig.getOptionalConfig(candidate);
    if (providerConfig) {
      providers[candidate] = {
        host: providerConfig.getOptionalString('host'),
        apiBaseUrl: providerConfig.getOptionalString('apiBaseUrl'),
      };
    }
  }

  return { provider, providers };
};

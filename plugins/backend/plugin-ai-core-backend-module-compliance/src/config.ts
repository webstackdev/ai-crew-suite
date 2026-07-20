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

export type PolicyProviderId = 'opa' | 'static';

export type OpaProviderConfig = {
  baseUrl?: string;
};

export type StaticPoliciesConfig = {
  path?: string;
};

export type ComplianceConfig = {
  policy: PolicyProviderId;
  opa?: OpaProviderConfig;
  staticPolicies?: StaticPoliciesConfig;
};

const POLICY_PROVIDERS: readonly PolicyProviderId[] = ['opa', 'static'];

const isPolicyProvider = (value: unknown): value is PolicyProviderId =>
  typeof value === 'string' && (POLICY_PROVIDERS as readonly string[]).includes(value);

export const readComplianceConfig = (config: Config): ComplianceConfig => {
  const complianceConfig = config.getOptionalConfig('ai.integrations.compliance');
  if (!complianceConfig) {
    throw new Error(
      'Compliance module requires ai.integrations.compliance configuration to be set',
    );
  }

  const policy = complianceConfig.getOptionalString('policy');
  if (!policy) {
    throw new Error('Compliance module requires ai.integrations.compliance.policy to be set');
  }
  if (!isPolicyProvider(policy)) {
    throw new Error(`Unsupported policy provider '${policy}'. Supported: ${POLICY_PROVIDERS.join(', ')}`);
  }

  const opaConfig = complianceConfig.getOptionalConfig('opa');
  const staticConfig = complianceConfig.getOptionalConfig('staticPolicies');

  return {
    policy,
    opa: opaConfig ? { baseUrl: opaConfig.getOptionalString('baseUrl') } : undefined,
    staticPolicies: staticConfig ? { path: staticConfig.getOptionalString('path') } : undefined,
  };
};

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

export type CloudAccountSummary = {
  id: string;
  name?: string;
  provider: string;
  region?: string;
  metadata?: Record<string, string>;
};

export type CloudResourceSummary = {
  id: string;
  type: string;
  provider: string;
  region?: string;
  tags?: Record<string, string>;
  owner?: string;
  catalogEntityRef?: string;
};

export type CloudDependencySummary = {
  resourceId: string;
  dependsOn: string[];
  dependedBy: string[];
};

export type KubernetesWorkloadSummary = {
  name: string;
  kind: string;
  namespace: string;
  replicas?: number;
  status?: string;
  images?: string[];
};

export interface CloudProviderDriver {
  readonly providerId: string;
  lookupAccount(input: {
    accountId?: string;
    name?: string;
  }): Promise<CloudAccountSummary | undefined>;
  lookupResource(input: {
    service?: string;
    tags?: Record<string, string>;
    owner?: string;
    catalogEntityRef?: string;
  }): Promise<CloudResourceSummary[]>;
  resourceDependencies(input: {
    resourceId: string;
  }): Promise<CloudDependencySummary>;
  kubernetesWorkloads(input: {
    cluster?: string;
    namespace?: string;
    catalogEntityRef?: string;
  }): Promise<KubernetesWorkloadSummary[]>;
}

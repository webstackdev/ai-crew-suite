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
import { LoggerService } from '@backstage/backend-plugin-api';
import {
  CloudAccountSummary,
  CloudDependencySummary,
  CloudProviderDriver,
  CloudResourceSummary,
  KubernetesWorkloadSummary,
} from './types';

export type AwsDriverConfig = {
  region?: string;
};

/**
 * AWS-backed cloud provider driver.
 *
 * This first pass is a stub. A real implementation will wire AWS SDK calls
 * for account, resource, and dependency lookups.
 */
export class AwsDriver implements CloudProviderDriver {
  readonly providerId = 'aws';
  private readonly logger: LoggerService;
  private readonly region: string;

  constructor(opts: { logger: LoggerService; config?: AwsDriverConfig }) {
    this.logger = opts.logger;
    this.region = opts.config?.region ?? 'us-east-1';
  }

  async lookupAccount(input: {
    accountId?: string;
    name?: string;
  }): Promise<CloudAccountSummary | undefined> {
    this.logger.debug('AwsDriver.lookupAccount stub invoked', input);
    return undefined;
  }

  async lookupResource(_input: {
    service?: string;
    tags?: Record<string, string>;
    owner?: string;
    catalogEntityRef?: string;
  }): Promise<CloudResourceSummary[]> {
    this.logger.debug('AwsDriver.lookupResource stub invoked');
    return [];
  }

  async resourceDependencies(input: {
    resourceId: string;
  }): Promise<CloudDependencySummary> {
    this.logger.debug('AwsDriver.resourceDependencies stub invoked', input);
    return { resourceId: input.resourceId, dependsOn: [], dependedBy: [] };
  }

  async kubernetesWorkloads(_input: {
    cluster?: string;
    namespace?: string;
    catalogEntityRef?: string;
  }): Promise<KubernetesWorkloadSummary[]> {
    this.logger.debug('AwsDriver.kubernetesWorkloads stub invoked');
    return [];
  }
}

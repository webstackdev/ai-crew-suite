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
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import {
  ResourceGroupsTaggingAPIClient,
  GetResourcesCommand
} from '@aws-sdk/client-resource-groups-tagging-api';
import { AwsCredentialsManager } from '@backstage/integration-aws-node';
import {
  CloudProviderDriver,
  CloudAccountSummary,
  CloudResourceSummary,
  CloudDependencySummary,
  KubernetesWorkloadSummary
} from '@webstackbuilders/plugin-ai-core-node';

export interface AwsDriverOptions {
  logger: any;
  credentialsManager: AwsCredentialsManager;
  config: { region: string };
}

export class AwsDriver implements CloudProviderDriver {
  readonly providerId = 'aws';
  private readonly logger: any;
  private readonly credentialsManager: AwsCredentialsManager;
  private readonly region: string;

  constructor(options: AwsDriverOptions) {
    this.logger = options.logger;
    this.credentialsManager = options.credentialsManager;
    this.region = options.config.region;
  }

  /**
   * Helper to retrieve authentic SDK credentials by pulling the underlying function provider.
   */
  private async getSdkConfig() {
    // Fixed: Pass target filters or empty config, then isolate the authentic SDK payload hook
    const resolvedCredentialWrapper = await this.credentialsManager.getCredentialProvider({});

    return {
      region: this.region,
      credentials: resolvedCredentialWrapper.sdkCredentialProvider, // Fixed: Extract nested provider reference
    };
  }

  async lookupAccount(): Promise<CloudAccountSummary | undefined> {
    this.logger.debug('Harvesting active landing zone tenancy contexts via official AWS SDK STS client');
    try {
      const sdkConfig = await this.getSdkConfig();
      const client = new STSClient(sdkConfig); // Fixed: Compiles safely against typed credentials
      const response = await client.send(new GetCallerIdentityCommand({}));
      
      return {
        id: response.Account || 'unknown-account',
        name: 'AWS Landing Zone',
        provider: 'aws',
        region: this.region,
      };
    } catch (err: any) {
      this.logger.error(`Failed to map AWS STS caller identity boundary: ${err.message}`);
      throw err;
    }
  }

  async lookupResource(input: { service?: string; tags?: Record<string, string> }): Promise<CloudResourceSummary[]> {
    this.logger.debug('Polling AWS Resource Groups Tagging API via official SDK client wrapper');
    try {
      const sdkConfig = await this.getSdkConfig();
      const client = new ResourceGroupsTaggingAPIClient(sdkConfig); // Fixed: Compiles safely against typed credentials

      const filters = Object.entries(input.tags || {}).map(([key, value]) => ({
        Key: key,
        Values: [value],
      }));

      const response = await client.send(new GetResourcesCommand({
        ResourceTypeFilters: input.service ? [input.service] : [],
        TagFilters: filters.length > 0 ? filters : undefined,
      }));

      const items = response.ResourceTagMappingList || [];
      return items.map((item: any) => {
        const arn = item.ResourceARN || '';
        const tagsObj: Record<string, string> = {};
        
        (item.Tags || []).forEach((t: any) => {
          tagsObj[t.Key] = t.Value;
        });

        return {
          id: arn,
          type: arn.split(':')[2] || 'unknown', // Cleanly slice out resource service domain space safely
          provider: 'aws',
          region: this.region,
          tags: tagsObj,
          owner: tagsObj.owner || tagsObj.team,
          catalogEntityRef: tagsObj['backstage.io/component'],
        };
      });
    } catch (err: any) {
      this.logger.error(`Error gathering live asset tracking topology matrix: ${err.message}`);
      throw err;
    }
  }

  async resourceDependencies(input: { resourceId: string }): Promise<CloudDependencySummary> {
    return { resourceId: input.resourceId, dependsOn: [], dependedBy: [] };
  }

  async kubernetesWorkloads(): Promise<KubernetesWorkloadSummary[]> {
    return [];
  }
}

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
import { CreateCloudProviderToolsOptions } from '@webstackbuilders/plugin-ai-core-node';

export function createCloudProviderTools(options: CreateCloudProviderToolsOptions) {
  const { driver, logger } = options;
  const tools: any[] = [];

  tools.push({
    name: `${driver.providerId}_lookup_account`,
    description: 'Retrieves structural configuration and baseline tags for a targeted landing zone or tenant account context.',
    execute: async (args: { accountId?: string; name?: string }) => {
      try {
        const summary = await driver.lookupAccount(args);
        return summary ? { account: summary } : { account: null };
      } catch (error: any) {
        logger.error(`Error executing lookup_account: ${error.message}`);
        return { error: error.message };
      }
    },
  });

  tools.push({
    name: `${driver.providerId}_lookup_resource`,
    description: 'Searches and returns live cloud inventory infrastructure metrics based on tags, service domains, or owner teams.',
    execute: async (args: { service?: string; tags?: Record<string, string>; owner?: string; catalogEntityRef?: string }) => {
      try {
        const resources = await driver.lookupResource(args);
        return { resources };
      } catch (error: any) {
        logger.error(`Error executing lookup_resource: ${error.message}`);
        return { error: error.message };
      }
    },
  });

  tools.push({
    name: `${driver.providerId}_resource_dependencies`,
    description: 'Evaluates dependent infrastructure matrices, parsing associated logical networking boundaries or cross-resource maps.',
    execute: async (args: { resourceId: string }) => {
      try {
        return await driver.resourceDependencies(args);
      } catch (error: any) {
        logger.error(`Error executing resource_dependencies: ${error.message}`);
        return { error: error.message };
      }
    },
  });

  tools.push({
    name: `${driver.providerId}_kubernetes_workloads`,
    description: 'Polls real-time workspace cluster allocations, pod failure status indicators, or deployment replica levels.',
    execute: async (args: { cluster?: string; namespace?: string; catalogEntityRef?: string }) => {
      try {
        const workloads = await driver.kubernetesWorkloads(args);
        return { workloads };
      } catch (error: any) {
        logger.error(`Error executing kubernetes_workloads: ${error.message}`);
        return { error: error.message };
      }
    },
  });

  return tools;
}

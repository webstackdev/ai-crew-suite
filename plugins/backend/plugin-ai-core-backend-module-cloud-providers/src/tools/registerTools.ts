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
import { ToolDefinition } from '@webstackbuilders/plugin-ai-core-node';
import { CloudProviderDriver } from '../providers';

type AccountLookupArgs = { accountId?: string; name?: string };
type ResourceLookupArgs = {
  service?: string;
  tags?: Record<string, string>;
  owner?: string;
  catalogEntityRef?: string;
};
type ResourceDependenciesArgs = { resourceId: string };
type K8sWorkloadsArgs = {
  cluster?: string;
  namespace?: string;
  catalogEntityRef?: string;
};

export const createCloudProviderTools = (opts: {
  driver: CloudProviderDriver;
  logger: LoggerService;
}): ToolDefinition[] => {
  const { driver, logger } = opts;

  return [
    {
      id: 'cloud.account.lookup',
      description: 'Resolve cloud account/project/subscription metadata',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as AccountLookupArgs;
        logger.debug('cloud.account.lookup invoked', payload);
        return driver.lookupAccount(payload);
      },
    },
    {
      id: 'cloud.resource.lookup',
      description: 'Find existing resources by service, tags, owner, or catalog entity',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as ResourceLookupArgs;
        logger.debug('cloud.resource.lookup invoked', payload);
        return driver.lookupResource(payload);
      },
    },
    {
      id: 'cloud.resource.dependencies',
      description: 'Return cloud dependencies around a service',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as ResourceDependenciesArgs;
        logger.debug('cloud.resource.dependencies invoked', payload);
        return driver.resourceDependencies(payload);
      },
    },
    {
      id: 'cloud.kubernetes.workloads',
      description: 'Inspect Kubernetes workloads for deployed infrastructure state',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as K8sWorkloadsArgs;
        logger.debug('cloud.kubernetes.workloads invoked', payload);
        return driver.kubernetesWorkloads(payload);
      },
    },
  ];
};

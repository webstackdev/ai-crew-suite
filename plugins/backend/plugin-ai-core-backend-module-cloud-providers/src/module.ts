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
import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { toolExtensionPoint } from '@webstackbuilders/plugin-ai-core-node';
import { readCloudProvidersConfig } from './config';
import { AwsDriver, CloudProviderDriver } from './providers';
import { createCloudProviderTools } from './tools';

export const aiCoreBackendModuleCloudProviders = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'cloud-providers',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        tools: toolExtensionPoint,
      },
      async init({ config, logger, tools }) {
        const cloudConfig = readCloudProvidersConfig(config);
        logger.info(
          `Initializing cloud providers module with default provider '${cloudConfig.defaultProvider}'`,
        );

        let driver: CloudProviderDriver;
        switch (cloudConfig.defaultProvider) {
          case 'aws':
            driver = new AwsDriver({
              logger: logger.child({ label: 'cloud-providers-aws' }),
              config: cloudConfig.providers.aws,
            });
            break;
          case 'azure':
          case 'gcp':
            throw new Error(
              `Cloud provider '${cloudConfig.defaultProvider}' is not implemented yet`,
            );
          default: {
            const exhaustive: never = cloudConfig.defaultProvider;
            throw new Error(`Unsupported cloud provider: ${exhaustive}`);
          }
        }

        for (const tool of createCloudProviderTools({ driver, logger })) {
          tools.addTool(tool);
        }
      },
    });
  },
});

export default aiCoreBackendModuleCloudProviders;

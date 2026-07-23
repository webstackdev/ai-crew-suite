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
// plugins/backend/plugin-ai-core-backend-module-cloud-providers/src/module.ts
import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import { 
  toolExtensionPoint,
  cloudDriversExtensionPoint,
  CloudProviderDriver
} from '@webstackbuilders/plugin-ai-core-node';
import { readCloudProvidersConfig } from './config';
import { createCloudProviderTools } from './registerTools';

/**
 * Cloud Providers backend module for the AI Core backend plugin.
 * Dynamically resolves provider driver modules via open extension points.
 */
export const aiCoreBackendModuleCloudProviders = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'cloud-providers',
  register(env) {
    // 1. Maintain an internal module-scoped map of registered cloud drivers
    const drivers = new Map<string, CloudProviderDriver>();

    // 2. Expose the Extension Point interface to allow independent cloud sub-plugins to register
    env.registerExtensionPoint(cloudDriversExtensionPoint, {
      registerDriver(driver) {
        drivers.set(driver.providerId, driver);
      },
    });

    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        tools: toolExtensionPoint,
      },
      async init({ config, logger, tools }) {
        const cloudConfig = readCloudProvidersConfig(config);

        // 3. Resolve the driver dictated by the app-config workspace setup dynamically
        const driver = drivers.get(cloudConfig.defaultProvider);

        if (!driver) {
          throw new Error(
            `No cloud driver registered for identifier '${cloudConfig.defaultProvider}'. ` +
            `Ensure the matching plugin package '@webstackbuilders/plugin-ai-core-backend-module-cloud-providers-${cloudConfig.defaultProvider}' ` +
            `is fully imported in your backend index.ts bootstrap initialization file.`
          );
        }

        logger.info(
          `Initializing active AI Cloud Agent framework utilizing registered driver: '${driver.providerId}'`,
        );

        // 4. Generate and bind the dynamic tool definitions straight to the execution engine
        for (const tool of createCloudProviderTools({ driver, logger })) {
          tools.addTool(tool);
        }
      },
    });
  },
});

export default aiCoreBackendModuleCloudProviders;

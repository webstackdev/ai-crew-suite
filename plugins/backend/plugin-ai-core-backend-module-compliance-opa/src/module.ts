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
import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import { complianceDriversExtensionPoint } from '@webstackbuilders/plugin-ai-core-node';
import { readOpaConfig } from './config';
import { OpaDriver } from './providers/OpaDriver';

/**
 * OPA driver backend module for the AI Core compliance group.
 */
export const aiCoreBackendModuleComplianceOpa = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'compliance-opa',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        complianceRegistry: complianceDriversExtensionPoint,
      },
      async init({ config, logger, complianceRegistry }) {
        logger.info('Initializing decoupled OPA compliance driver module...');

        complianceRegistry.registerDriver(
          new OpaDriver({
            logger: logger.child({ label: 'compliance-opa-driver' }),
            config: readOpaConfig(config),
          }),
        );
      },
    });
  },
});

export default aiCoreBackendModuleComplianceOpa;
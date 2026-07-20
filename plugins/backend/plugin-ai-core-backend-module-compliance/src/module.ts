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
import { readComplianceConfig } from './config';
import { ComplianceDriver, OpaDriver } from './providers';
import { createComplianceTools } from './tools';

export const aiCoreBackendModuleCompliance = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'compliance',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        tools: toolExtensionPoint,
      },
      async init({ config, logger, tools }) {
        const complianceConfig = readComplianceConfig(config);
        logger.info(
          `Initializing compliance module with policy provider '${complianceConfig.policy}'`,
        );

        let driver: ComplianceDriver;
        switch (complianceConfig.policy) {
          case 'opa':
            driver = new OpaDriver({
              logger: logger.child({ label: 'compliance-opa' }),
              config: complianceConfig.opa,
            });
            break;
          case 'static':
            throw new Error(
              `Compliance policy provider '${complianceConfig.policy}' is not implemented yet`,
            );
          default: {
            const exhaustive: never = complianceConfig.policy;
            throw new Error(`Unsupported policy provider: ${exhaustive}`);
          }
        }

        for (const tool of createComplianceTools({ driver, logger })) {
          tools.addTool(tool);
        }
      },
    });
  },
});

export default aiCoreBackendModuleCompliance;

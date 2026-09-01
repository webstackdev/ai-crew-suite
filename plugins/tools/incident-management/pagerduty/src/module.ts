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
import { incidentManagementDriversExtensionPoint } from '@webstackbuilders/plugin-ai-core-node';
import { PagerDutyDriver } from './providers/PagerDutyDriver';
import { readPagerDutyConfig } from './config';

/**
 * PagerDuty driver backend module for the AI Core incident management group.
 */
export const aiCoreBackendModuleIncidentManagementPagerduty = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'incident-management-pagerduty',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        incidentRegistry: incidentManagementDriversExtensionPoint,
      },
      async init({ config, logger, incidentRegistry }) {
        logger.info('Initializing decoupled PagerDuty incident management driver module...');

        incidentRegistry.registerDriver(
          new PagerDutyDriver({
            logger: logger.child({ label: 'incident-management-pagerduty-driver' }),
            config: readPagerDutyConfig(config),
          }),
        );
      },
    });
  },
});

export default aiCoreBackendModuleIncidentManagementPagerduty;

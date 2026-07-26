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
import { qualityScorecardsExtensionPoint } from '@webstackbuilders/plugin-ai-core-node';
import { TechRadarDriver } from './providers/TechRadarDriver';

export const aiCoreModuleQualityScorecardsTechRadar = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'quality-scorecards-techradar',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        qualityRegistry: qualityScorecardsExtensionPoint,
      },
      async init({ config, logger, qualityRegistry }) {
        logger.info('Initializing AI Quality Scorecards TechRadar proposals module...');

        // Instantiate the driver passing the global platform config object
        const driver = new TechRadarDriver({
          logger: logger.child({ label: 'quality-scorecards-techradar-driver' }),
          config,
        });

        // Register cleanly into the shared orchestrator mapping registry matrix
        qualityRegistry.registerDriver(driver);
      },
    });
  },
});

export default aiCoreModuleQualityScorecardsTechRadar;

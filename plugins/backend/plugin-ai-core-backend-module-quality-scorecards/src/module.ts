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
import {
  toolExtensionPoint,
  qualityScorecardsExtensionPoint,
  QualityScorecardsDriver
} from '@webstackbuilders/plugin-ai-core-node';
import { readQualityScorecardsConfig } from './config';
import { createQualityScorecardsTools } from './registerTools';

export const aiCoreBackendModuleQualityScorecards = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'quality-scorecards',
  register(env) {
    // 1. Maintain an internal module-scoped map of registered quality compliance drivers
    const drivers = new Map<string, QualityScorecardsDriver>();

    // 2. Expose the Extension Point interface to handle dynamic boot registration loops
    env.registerExtensionPoint(qualityScorecardsExtensionPoint, {
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
        const qualityConfig = readQualityScorecardsConfig(config);

        // 3. Resolve the driver dictated by config values completely from the runtime Map
        const driver = drivers.get(qualityConfig.provider);

        if (!driver) {
          throw new Error(
            `No compliance driver registered for identifier '${qualityConfig.provider}'. ` +
            `Ensure the matching plugin bundle package '@webstackbuilders/plugin-ai-core-backend-module-quality-scorecards-${qualityConfig.provider}' is fully imported.`
          );
        }

        logger.info(
          `Initializing active Quality Scorecards agent wrapper utilizing registered driver: '${driver.providerId}'`
        );

        // 4. Translate capabilities and mount tools inside the central execution registry
        for (const tool of createQualityScorecardsTools({ driver, logger })) {
          tools.addTool(tool);
        }
      },
    });
  },
});

export default aiCoreBackendModuleQualityScorecards;

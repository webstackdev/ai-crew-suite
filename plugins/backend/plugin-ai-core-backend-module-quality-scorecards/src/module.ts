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
import { readQualityScorecardsConfig } from './config';
import { QualityScorecardDriver, SoundcheckDriver } from './providers';
import { createQualityScorecardTools } from './tools';

export const aiCoreBackendModuleQualityScorecards = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'quality-scorecards',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        tools: toolExtensionPoint,
      },
      async init({ config, logger, tools }) {
        const qualityConfig = readQualityScorecardsConfig(config);
        logger.info(
          `Initializing quality scorecards module with provider '${qualityConfig.provider}'`,
        );

        let driver: QualityScorecardDriver;
        switch (qualityConfig.provider) {
          case 'soundcheck':
            driver = new SoundcheckDriver({
              logger: logger.child({ label: 'quality-scorecards-soundcheck' }),
              config: qualityConfig.providers.soundcheck,
            });
            break;
          case 'scorecards':
          case 'internal':
            throw new Error(
              `Quality scorecards provider '${qualityConfig.provider}' is not implemented yet`,
            );
          default: {
            const exhaustive: never = qualityConfig.provider;
            throw new Error(`Unsupported quality provider: ${exhaustive}`);
          }
        }

        for (const tool of createQualityScorecardTools({ driver, logger })) {
          tools.addTool(tool);
        }
      },
    });
  },
});

export default aiCoreBackendModuleQualityScorecards;

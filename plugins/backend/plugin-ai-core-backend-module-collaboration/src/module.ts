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
import { readCollaborationConfig } from './config';
import { CollaborationDriver, JiraDriver, SlackDriver } from './providers';
import { createCollaborationTools } from './tools';

/**
 * Collaboration backend module for the AI Core backend plugin.
 *
 * The module contributes stable, provider-neutral ticketing and messaging
 * tools to the AI tool registry. Provider-specific behavior is selected through
 * `ai.integrations.collaboration` configuration and hidden behind
 * `CollaborationDriver` implementations.
 *
 * @public
 */
export const aiCoreBackendModuleCollaboration = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'collaboration',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        tools: toolExtensionPoint,
      },
      async init({ config, logger, tools }) {
        const collabConfig = readCollaborationConfig(config);
        logger.info(
          `Initializing collaboration module with ticketing '${collabConfig.ticketing}' and messaging '${collabConfig.messaging}'`,
        );

        let ticketingDriver: CollaborationDriver;
        switch (collabConfig.ticketing) {
          case 'jira':
            ticketingDriver = new JiraDriver({
              logger: logger.child({ label: 'collaboration-jira' }),
              config: collabConfig.ticketingProviders.jira,
            });
            break;
          case 'linear':
            throw new Error(
              `Collaboration ticketing provider '${collabConfig.ticketing}' is not implemented yet`,
            );
          default: {
            const exhaustive: never = collabConfig.ticketing;
            throw new Error(`Unsupported ticketing provider: ${exhaustive}`);
          }
        }

        let messagingDriver: CollaborationDriver;
        switch (collabConfig.messaging) {
          case 'slack':
            messagingDriver = new SlackDriver({
              logger: logger.child({ label: 'collaboration-slack' }),
              config: collabConfig.messagingProviders.slack,
            });
            break;
          case 'teams':
            throw new Error(
              `Collaboration messaging provider '${collabConfig.messaging}' is not implemented yet`,
            );
          default: {
            const exhaustive: never = collabConfig.messaging;
            throw new Error(`Unsupported messaging provider: ${exhaustive}`);
          }
        }

        for (const tool of createCollaborationTools({
          ticketingDriver,
          messagingDriver,
          logger,
        })) {
          tools.addTool(tool);
        }
      },
    });
  },
});

export default aiCoreBackendModuleCollaboration;

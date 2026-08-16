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
import {
  MessagingProviderDriver,
  TicketProviderDriver,
  messagingDriversExtensionPoint,
  ticketDriversExtensionPoint,
  toolExtensionPoint,
} from '@webstackbuilders/plugin-ai-core-node';
import { readCollaborationConfig } from './config';
import { createCollaborationTools } from './tools';

/**
 * Collaboration backend module for the AI Core backend plugin.
 *
 * The module owns the provider-neutral ticketing and messaging tool surface and
 * resolves the active drivers from two extension point registries populated by
 * sibling `-<provider>` modules at boot time.
 */
export const aiCoreBackendModuleCollaboration = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'collaboration',
  register(env) {
    // 1. Maintain module-scoped maps of registered drivers, one per capability
    const ticketDrivers = new Map<string, TicketProviderDriver>();
    const messagingDrivers = new Map<string, MessagingProviderDriver>();

    // 2. Expose the Extension Point interfaces to the Backstage framework
    env.registerExtensionPoint(ticketDriversExtensionPoint, {
      registerDriver(driver) {
        ticketDrivers.set(driver.providerId, driver);
      },
    });

    env.registerExtensionPoint(messagingDriversExtensionPoint, {
      registerDriver(driver) {
        messagingDrivers.set(driver.providerId, driver);
      },
    });

    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        tools: toolExtensionPoint,
      },
      async init({ config, logger, tools }) {
        const collabConfig = readCollaborationConfig(config);

        // 3. Resolve the drivers dictated by config completely from the runtime Maps
        const ticketDriver = ticketDrivers.get(collabConfig.ticketing);
        if (!ticketDriver) {
          throw new Error(
            `No ticket driver registered for identifier '${collabConfig.ticketing}'. ` +
              `Ensure the matching @webstackbuilders/plugin-ai-core-backend-module-collaboration-${collabConfig.ticketing} package is imported in your backend index.ts file.`,
          );
        }

        const messagingDriver = messagingDrivers.get(collabConfig.messaging);
        if (!messagingDriver) {
          throw new Error(
            `No messaging driver registered for identifier '${collabConfig.messaging}'. ` +
              `Ensure the matching @webstackbuilders/plugin-ai-core-backend-module-collaboration-${collabConfig.messaging} package is imported in your backend index.ts file.`,
          );
        }

        logger.info(
          `Initializing active collaboration agent wrapper utilizing registered drivers: ticketing '${ticketDriver.providerId}', messaging '${messagingDriver.providerId}'`,
        );

        // 4. Mount the normalized tools inside the central execution registry
        for (const tool of createCollaborationTools({
          ticketDriver,
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

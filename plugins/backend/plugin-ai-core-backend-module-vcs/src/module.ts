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
import { ScmIntegrations, DefaultGithubCredentialsProvider } from '@backstage/integration';
import { toolExtensionPoint } from '@webstackbuilders/plugin-ai-core-node';
import { readVcsConfig } from './config';
import { vcsDriversExtensionPoint } from './extensions';
import { GitHubDriver, AzureDriver, GitLabDriver, VcsDriver } from './providers';
import { createVcsTools } from './tools';

export const aiCoreBackendModuleVcs = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'vcs',
  register(env) {
    // Shared registry instance inside the module lifetime block
    const drivers = new Map<string, VcsDriver>();

    // Expose the registration hooks to external modules at boot time
    env.registerExtensionPoint(vcsDriversExtensionPoint, {
      registerDriver(driver) {
        drivers.set(driver.providerId, driver);
      },
    });

    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        urlReader: coreServices.urlReader,
        tools: toolExtensionPoint,
      },
      async init({ config, logger, urlReader, tools }) {
        const vcsConfig = readVcsConfig(config);

        const integrations = ScmIntegrations.fromConfig(config);
        const githubCredentialsProvider = DefaultGithubCredentialsProvider.fromIntegrations(integrations);

        // Natively bundle your core drivers right out of the box
        const github = new GitHubDriver({ urlReader, logger, integrations, credentialsProvider: githubCredentialsProvider });
        const azure = new AzureDriver({ urlReader, logger, integrations });
        const gitlab = new GitLabDriver({ urlReader, logger, integrations });

        drivers.set(github.providerId, github);
        drivers.set(azure.providerId, azure);
        drivers.set(gitlab.providerId, gitlab);

        // Dynamically extract the configured provider targeting your agents
        const driver = drivers.get(vcsConfig.provider);

        if (!driver) {
          throw new Error(
            `VCS active provider configuration error: Driver matching '${vcsConfig.provider}' was not registered.`,
          );
        }

        logger.info(`Initializing active AI Tool wrapper utilizing driver: '${driver.providerId}'`);

        for (const tool of createVcsTools({ driver, logger })) {
          tools.addTool(tool);
        }
      },
    });
  },
});

export default aiCoreBackendModuleVcs;

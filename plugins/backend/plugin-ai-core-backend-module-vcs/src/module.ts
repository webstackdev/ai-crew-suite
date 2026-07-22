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
import {
  AzureDriver,
  GitHubDriver,
  VcsDriver,
} from './providers';
import { createVcsTools } from './tools';

/**
 * VCS backend module for the AI Core backend plugin.
 *
 * @public
 */
export const aiCoreBackendModuleVcs = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'vcs',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        urlReader: coreServices.urlReader,
        tools: toolExtensionPoint,
      },
      async init({ config, logger, urlReader, tools }) {
        const vcsConfig = readVcsConfig(config);
        logger.info(
          `Initializing VCS module with provider '${vcsConfig.provider}'`,
        );

        // Natively instantiate the SCM manager using the core root configuration
        const integrations = ScmIntegrations.fromConfig(config);

        // Feed the integrations instance into the credentials factory method
        const githubCredentialsProvider = DefaultGithubCredentialsProvider.fromIntegrations(integrations);


        let driver: VcsDriver;
        switch (vcsConfig.provider) {
          case 'github':
            driver = new GitHubDriver({
              urlReader,
              logger: logger.child({ label: 'vcs-github' }),
              integrations,
              credentialsProvider: githubCredentialsProvider,
            });
            break;
          case 'azuredevops':
            driver = new AzureDriver({
              urlReader,
              logger: logger.child({ label: 'vcs-azuredevops' }),
              integrations,
            });
            break;
          case 'gitlab':
          case 'bitbucket':
            throw new Error(`VCS provider '${vcsConfig.provider}' is not implemented yet`);
          default: {
            const exhaustive: never = vcsConfig.provider;
            throw new Error(`Unsupported VCS provider: ${exhaustive}`);
          }
        }

        for (const tool of createVcsTools({ driver, logger })) {
          tools.addTool(tool);
        }
      },
    });
  },
});

export default aiCoreBackendModuleVcs;

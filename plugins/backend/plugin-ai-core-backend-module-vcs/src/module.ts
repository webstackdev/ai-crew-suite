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
import {
  GitHubDriver,
  AzureDriver,
  GitLabDriver,
  BitbucketDriver,
  VcsDriver
} from './providers';
import { createVcsTools } from './tools';

/**
 * VCS backend module for the AI Core backend plugin.
 * Now refactored to support open-ended driver registrations via Extension Points.
 *
 * @public
 */
export const aiCoreBackendModuleVcs = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'vcs',
  register(env) {
    // 1. Maintain an internal module-scoped map of registered drivers
    const drivers = new Map<string, VcsDriver>();

    // 2. Expose the Extension Point interface to the Backstage framework
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

        // Setup central Backstage SCM parameters used by built-in drivers
        const integrations = ScmIntegrations.fromConfig(config);
        const githubCredentialsProvider = DefaultGithubCredentialsProvider.fromIntegrations(integrations);

        // 3. Register native ecosystem drivers out of the box
        const nativeDrivers: VcsDriver[] = [
          new GitHubDriver({ urlReader, logger: logger.child({ label: 'vcs-github' }), integrations, credentialsProvider: githubCredentialsProvider }),
          new AzureDriver({ urlReader, logger: logger.child({ label: 'vcs-azuredevops' }), integrations }),
          new GitLabDriver({ urlReader, logger: logger.child({ label: 'vcs-gitlab' }), integrations }),
          new BitbucketDriver({ urlReader, logger: logger.child({ label: 'vcs-bitbucket' }), integrations }),
        ];

        for (const nativeDriver of nativeDrivers) {
          drivers.set(nativeDriver.providerId, nativeDriver);
        }

        // 4. Resolve the driver dictated by the user's ai.integrations.vcs.provider config
        const driver = drivers.get(vcsConfig.provider);

        if (!driver) {
          throw new Error(
            `VCS provider configuration mismatch: No driver registered for provider identifier '${vcsConfig.provider}'. Available options: ${Array.from(drivers.keys()).join(', ')}`,
          );
        }

        logger.info(
          `Initializing active VCS agent wrapper utilizing registered driver: '${driver.providerId}'`,
        );

        // 5. Expose the tools to the main AI plugin
        for (const tool of createVcsTools({ driver, logger })) {
          tools.addTool(tool);
        }
      },
    });
  },
});

export default aiCoreBackendModuleVcs;

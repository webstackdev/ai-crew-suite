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
import { cloudDriversExtensionPoint } from '@webstackbuilders/plugin-ai-core-node';
import { KubernetesDriver } from './providers/KubernetesDriver';

export const aiCoreBackendModuleCloudProvidersKubernetes = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'cloud-providers-kubernetes',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        cloudRegistry: cloudDriversExtensionPoint,
      },
      async init({ config, logger, cloudRegistry }) {
        logger.info('Initializing decoupled AI Kubernetes Cloud Provider module...');

        // Safely extract the optional block scoped down to this specific sub-namespace
        const k8sConfigSection = config.getOptionalConfig(
          'ai.integrations.cloudProviders.providers.kubernetes'
        );

        const targetNamespaces = k8sConfigSection?.getOptionalStringArray('targetNamespaces') || ['default'];

        const driver = new KubernetesDriver({
          logger: logger.child({ label: 'cloud-provider-kubernetes-driver' }),
          config: { targetNamespaces },
        });

        // Register seamlessly into the shared orchestrator mapping registry
        cloudRegistry.registerDriver(driver);
      },
    });
  },
});

export default aiCoreBackendModuleCloudProvidersKubernetes;

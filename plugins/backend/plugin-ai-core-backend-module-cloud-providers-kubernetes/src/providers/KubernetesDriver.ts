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
import { CoreV1Api, KubeConfig } from '@kubernetes/client-node';
import { Config } from '@backstage/config';
import {
  CloudProviderDriver,
  CloudAccountSummary,
  CloudResourceSummary,
  CloudDependencySummary,
  KubernetesWorkloadSummary
} from '@webstackbuilders/plugin-ai-core-node';

export interface KubernetesDriverOptions {
  logger: any;
  rootConfig: Config;
  config: { targetNamespaces: string[] };
}

export class KubernetesDriver implements CloudProviderDriver {
  readonly providerId = 'kubernetes';
  private readonly logger: any;
  private readonly rootConfig: Config;
  private readonly targetNamespaces: string[];

  constructor(options: KubernetesDriverOptions) {
    this.logger = options.logger;
    this.rootConfig = options.rootConfig;
    this.targetNamespaces = options.config.targetNamespaces;
  }

  // Mandatory implementation placeholder satisfying the unified interface contract
  async lookupAccount(): Promise<CloudAccountSummary | undefined> {
    return { id: 'k8s-local-cluster', name: 'In-Cluster Context', provider: 'kubernetes' };
  }
  async lookupResource(): Promise<CloudResourceSummary[]> { return []; }
  async resourceDependencies(): Promise<CloudDependencySummary> {
    return { resourceId: 'kubernetes', dependsOn: [], dependedBy: [] };
  }

  /**
   * Manually builds native KubeConfig profiles by parsing the official shared 'kubernetes' configuration block,
   * reusing the precise credentials (serviceAccount token, cluster URL) platform users already configured.
   */
  private getKubeClients(): { name: string; client: CoreV1Api }[] {
    const clients: { name: string; client: CoreV1Api }[] = [];
    const k8sConfig = this.rootConfig.getOptionalConfig('kubernetes');
    if (!k8sConfig) return clients;

    const clusters = k8sConfig.getOptionalConfigArray('clusters') || [];

    for (const clusterConfig of clusters) {
      const name = clusterConfig.getString('name');
      const url = clusterConfig.getString('url');
      const serviceAccountToken = clusterConfig.getOptionalString('serviceAccountToken');

      const kc = new KubeConfig();
      
      // Inject standard target environments matching your user's existing settings
      kc.loadFromString(JSON.stringify({
        apiVersion: 'v1',
        kind: 'Config',
        clusters: [{ name, cluster: { server: url, 'insecure-skip-tls-verify': true } }],
        contexts: [{ name, context: { cluster: name, user: name } }],
        'current-context': name,
        users: [{ name, user: { token: serviceAccountToken } }],
      }));

      clients.push({
        name,
        client: kc.makeApiClient(CoreV1Api),
      });
    }

    return clients;
  }

  async kubernetesWorkloads(input: { cluster?: string; namespace?: string }): Promise<KubernetesWorkloadSummary[]> {
    const namespacesToScan = input.namespace ? [input.namespace] : this.targetNamespaces;
    const summaries: KubernetesWorkloadSummary[] = [];

    const clusterClients = this.getKubeClients();
    const targets = input.cluster ? clusterClients.filter(c => c.name === input.cluster) : clusterClients;

    for (const target of targets) {
      for (const ns of namespacesToScan) {
        this.logger.debug(`Polling live cluster pods for target cluster [${target.name}] inside namespace: ${ns}`);

        try {
          // Native SDK call execution
          const response = await target.client.listNamespacedPod({ namespace: ns });
          const pods = response.items || [];

          for (const pod of pods) {
            const name = pod.metadata?.name || 'unknown';
            let status = pod.status?.phase || 'Unknown';
            const containerStatuses = pod.status?.containerStatuses || [];

            for (const cs of containerStatuses) {
              if (cs.state?.waiting) {
                status = cs.state.waiting.reason || status;
              } else if (cs.state?.terminated) {
                status = cs.state.terminated.reason || status;
              }
            }

            const images = pod.spec?.containers?.map(c => c.image || '') || [];

            summaries.push({
              name,
              kind: 'Pod',
              namespace: ns,
              status,
              replicas: 1,
              images,
            });
          }
        } catch (err: any) {
          this.logger.error(`Error loading cluster workloads for target '${target.name}/${ns}': ${err.message}`);
          throw err;
        }
      }
    }

    return summaries;
  }
}

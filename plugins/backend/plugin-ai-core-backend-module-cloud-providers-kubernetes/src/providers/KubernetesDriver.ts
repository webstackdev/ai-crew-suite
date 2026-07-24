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
  CloudProviderDriver, 
  DriverOptions, 
  CloudAccountSummary, 
  CloudResourceSummary, 
  CloudDependencySummary, 
  KubernetesWorkloadSummary 
} from '@webstackbuilders/plugin-ai-core-node';

export class KubernetesDriver implements CloudProviderDriver {
  readonly providerId = 'kubernetes';
  private readonly logger: any;
  private readonly targetNamespaces: string[];

  constructor(options: DriverOptions) {
    this.logger = options.logger;
    this.targetNamespaces = options.config?.targetNamespaces || ['default'];
  }

  // Mandatory implementation placeholder satisfying the unified interface contract
  async lookupAccount(): Promise<CloudAccountSummary | undefined> {
    return {
      id: 'k8s-local-cluster',
      name: 'In-Cluster Context',
      provider: 'kubernetes',
    };
  }

  // Mandatory implementation placeholder satisfying the unified interface contract
  async lookupResource(): Promise<CloudResourceSummary[]> {
    return [];
  }

  // Mandatory implementation placeholder satisfying the unified interface contract
  async resourceDependencies(): Promise<CloudDependencySummary> {
    return { resourceId: 'kubernetes', dependsOn: [], dependedBy: [] };
  }

  /**
   * Fetches live pods and deployments across targeted namespaces,
   * isolating container statuses like OOMKilled or ImagePullBackOff.
   */
  async kubernetesWorkloads(input: { namespace?: string }): Promise<KubernetesWorkloadSummary[]> {
    const namespacesToScan = input.namespace ? [input.namespace] : this.targetNamespaces;
    const summaries: KubernetesWorkloadSummary[] = [];

    for (const ns of namespacesToScan) {
      this.logger.debug(`Polling workload data from live cluster API for namespace: ${ns}`);
      
      try {
        // Query pods directly from the core Kubernetes v1 endpoint
        const response = await fetch(`https://default.svc{ns}/pods`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`K8s API returned non-OK status: ${response.status}`);
        }

        const rawData = await response.json();
        const pods = rawData.items || [];

        for (const pod of pods) {
          const name = pod.metadata?.name || 'unknown';
          
          // Determine status by analyzing lifecycle structures
          let status = pod.status?.phase || 'Unknown';
          const containerStatuses = pod.status?.containerStatuses || [];
          
          for (const cs of containerStatuses) {
            if (cs.state?.waiting) {
              // Extract actionable failure signatures like OOMKilled or ImagePullBackOff
              status = cs.state.waiting.reason || status;
            } else if (cs.state?.terminated) {
              status = cs.state.terminated.reason || status;
            }
          }

          // Isolate image tags securely
          const images = pod.spec?.containers?.map((c: any) => c.image as string) || [];

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
        this.logger.error(`Failed executing scan block inside namespace '${ns}': ${err.message}`);
        throw err;
      }
    }

    return summaries;
  }
}

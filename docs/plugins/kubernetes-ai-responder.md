---
layout: default
title: Incident Triage Assistant
parent: Incident Response
plugin_name: plugin-ai-agent-backend-kubernetes-ai-responder
subcategory: Operations
---

# Incident Triage Assistant

{: .no_toc }

<span class="label label-blue">{{ page.subcategory }}</span>

---

## Overview

This plugin interfaces with your active Kubernetes infrastructure to parse error states, investigate pod logs, and serve real-time remediation playbooks.

- **The Task:** Providing a "likely cause" summary when a service fails.
- **The Logic:** An agent monitors [Kubernetes](https://medium.com/@naeemulhaq/architecting-an-internal-developer-platform-idp-with-backstage-and-kubernetes-9ec6311d866d) status in Backstage and, upon failure, gathers logs, traces, and recent PRs to build a root-cause hypothesis.
- **Framework:** **LangGraph** for the stateful investigate → gather → summarize workflow.

## Dependencies & Mock Targets

This assistant is inherently **event-driven and stateful**. It relies on trigger mechanisms to detect failures, followed by an investigative cycle that reaches deep into the Backstage operational ecosystem.

### 1. Core Backstage Services (`coreServices`)

- **`coreServices.scheduler`**: Powers the orchestration layer if the agent regularly polls Kubernetes namespaces for health degradations.
- **`coreServices.events`**: Essential if you are using Backstage's native event broker to trigger the agent reactively (e.g., listening for a `CloudEvents` payload sent by an external Prometheus/Alertmanager webhook or Kubernetes operator).
- **`coreServices.database`**: Backs the persistent session layers, LangGraph checkpoints (for state rollbacks), and human-in-the-loop approval gates.

### 2. Sibling Plugins (Investigation Target Interfaces)

The agent treats these plugins as data sources for its investigative steps:

- **Kubernetes diagnostics module**: The first investigation source. The agent
  resolves the affected workload and reads pod snapshots, status codes (for
  example `OOMKilled` and `ImagePullBackOff`), bounded log excerpts, and related
  events through `kubernetes.*` tools.
- **VCS module**: Fetches recent commits and pull requests for the component's
  repository to identify deployments that correlate with the incident window.
- **Observability module**: Scans traces, logs, and error-rate signals matching
  the failure timeline.

Kubernetes is an investigation surface, not the default trigger. The workflow is
started by an Alertmanager, Datadog, PagerDuty, or Prometheus webhook; a deployed
Kubernetes operator/webhook; or a bounded scheduler poll. It then uses the
Kubernetes diagnostics tools as its first evidence-gathering step.

## Testing Strategy

Because this assistant utilizes **LangGraph** for a multi-step _investigate \(\rightarrow \) gather \(\rightarrow \) summarize_ graph structure, your tests must validate that the graph correctly transitions between nodes based on the data it encounters.

### 1. LangGraph State Machine & Checkpoint Testing

You must verify that if the graph encounters an `OOMKilled` status from Kubernetes, it transitions to the _gather logs/traces_ node, but if it encounters an `ImagePullBackOff`, it transitions straight to a _gather recent PRs/registry logs_ node.

Use an **in-memory LangGraph memory saver checkpoint manager** backed by `mockServices.database` to test state transitions. This allows you to verify that if a human operator needs to approve a write action (e.g., clicking "Approve Rollback" via an SSE stream), the LangGraph workflow can successfully freeze at a checkpoint and safely resume when the approval arrives.

### 2. Mocking Inter-Plugin Data Streams

Instead of a simple static string, your mocks for this agent must represent a timeline of failure indicators. Use a fake `KubernetesDiagnosticsDriver` that returns normalized workload, pod, log, and event records through the Kubernetes diagnostics module's extension point.

Here is an example setup initializing a `startTestBackend` matrix specifically designed to evaluate the LangGraph agent's investigative pathing:

```typescript
import { createBackendModule } from '@backstage/backend-plugin-api';
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import kubernetesDiagnosticsModule from '@webstackbuilders/plugin-ai-core-backend-module-kubernetes';
import { kubernetesDiagnosticsDriversExtensionPoint } from '@webstackbuilders/plugin-ai-core-node';
import { kubernetesAiResponderPlugin } from '../plugin';

// Mock normalized Kubernetes diagnostics showing an out-of-memory failure.
const mockKubernetesDriver = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'kubernetes-diagnostics-mock',
  register(env) {
    env.registerInit({
      deps: { registry: kubernetesDiagnosticsDriversExtensionPoint },
      async init({ registry }) {
        registry.registerDriver({
          providerId: 'backstage',
          resolveWorkloads: async () => [
            {
              cluster: 'production',
              namespace: 'payments',
              name: 'payment-gateway',
              kind: 'Deployment',
            },
          ],
          getWorkloadSnapshot: async () => ({
            cluster: 'production',
            namespace: 'payments',
            name: 'payment-gateway',
            kind: 'Deployment',
            pods: [
              {
                cluster: 'production',
                namespace: 'payments',
                name: 'payment-gateway-abc',
                phase: 'Failed',
                containers: [
                  {
                    name: 'app',
                    ready: false,
                    restartCount: 3,
                    state: 'terminated',
                    reason: 'OOMKilled',
                  },
                ],
              },
            ],
            conditions: [],
          }),
          getPodSnapshot: async () => ({
            cluster: 'production',
            namespace: 'payments',
            name: 'payment-gateway-abc',
            phase: 'Failed',
            containers: [],
          }),
          getPodLogs: async () => ({
            cluster: 'production',
            namespace: 'payments',
            pod: 'payment-gateway-abc',
            previous: false,
            text: 'Fatal error: JavaScript heap out of memory',
            truncated: false,
          }),
          listWorkloadEvents: async () => [],
          getWorkloadTimeline: async () => ({ events: [], snapshots: [] }),
        });
      },
    });
  },
});

// 3. Execute the LangGraph workflow test
describe('Incident Triage Assistant Graph Execution', () => {
  it('should route through the OOMKilled investigation graph and flag the memory constraint PR', async () => {
    const { server } = await startTestBackend({
      features: [
        kubernetesAiResponderPlugin(),
        kubernetesDiagnosticsModule,
        mockKubernetesDriver,
        mockServices.catalog.factory({
          entities: [
            {
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              metadata: {
                name: 'payment-gateway',
                annotations: {
                  'backstage.io/kubernetes-id': 'payment-gateway-pod',
                  '://github.com': 'org/payment-gateway',
                },
              },
            },
          ],
        }),
        mockServices.database.factory(), // Preserves LangGraph checkpoint states
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    // Invoke your plugin's LangGraph execution loop and assert that the graph
    // populated the final state machine context with both the heap dump error log
    // and the specific PR ID (#402) as the high-probability culprit.
  });
});
```

### 3. Testing Trigger-Based Execution

If your plugin registers a route to receive incoming alert webhooks (e.g., from Prometheus or Datadog), do not use an external runner to emit HTTP traffic to it during testing.

Instead, write a standard component test inside your plugin folder that posts a mock alert payload directly to your plugin's `httpRouter` endpoint using `supertest`. Assert that your LangGraph runtime immediately spawns a new **Run ID**, writes a starting snapshot checkpoint to the database, and begins streaming tool execution logs over Server-Sent Events (SSE).

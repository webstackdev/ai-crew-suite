---
layout: default
title: Incident Triage Assistant
parent: Incident Response
plugin_name: kubernetes-ai-responder
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

- **`KubernetesBackend` / `KubernetesService`**: The initial trigger source. The agent pulls pod descriptors, status codes (e.g., `OOMKilled`, `ImagePullBackOff`), and raw stdout/stderr logs.
- **`GithubBackend` / `GithubService`**: Used by the agent to fetch the git commit history and recent Pull Requests for the component to see if a recent code deployment correlates with the incident window.
- **Observability Plugins (Datadog, OpenTelemetry, Jaeger)**: Provides API hooks to scan recent distributed trace anomalies or error-rate spikes matching the failing service's timeline.

## Testing Strategy

Because this assistant utilizes **LangGraph** for a multi-step _investigate \(\rightarrow \) gather \(\rightarrow \) summarize_ graph structure, your tests must validate that the graph correctly transitions between nodes based on the data it encounters.

### 1. LangGraph State Machine & Checkpoint Testing

You must verify that if the graph encounters an `OOMKilled` status from Kubernetes, it transitions to the _gather logs/traces_ node, but if it encounters an `ImagePullBackOff`, it transitions straight to a _gather recent PRs/registry logs_ node.

Use an **in-memory LangGraph memory saver checkpoint manager** backed by `mockServices.database` to test state transitions. This allows you to verify that if a human operator needs to approve a write action (e.g., clicking "Approve Rollback" via an SSE stream), the LangGraph workflow can successfully freeze at a checkpoint and safely resume when the approval arrives.

### 2. Mocking Inter-Plugin Data Streams

Instead of a simple static string, your mocks for this agent must represent a timeline of failure indicators. You can implement this cleanly by configuring a stateful mock service factory.

Here is an example setup initializing a `startTestBackend` matrix specifically designed to evaluate the LangGraph agent's investigative pathing:

```typescript
import { createServiceFactory } from '@backstage/backend-plugin-api';
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import { kubernetesAiResponderPlugin } from '../plugin';

// 1. Mock a Kubernetes system showing an Out Of Memory error
const mockK8sIncidentFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'kubernetes.service' }),
  deps: {},
  async factory() {
    return {
      getPodDiagnosticData: async (podName: string) => ({
        status: { phase: 'Failed', reason: 'OOMKilled' },
        logs: 'Fatal error: JavaScript heap out of memory\nFATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed...',
        lastTransitionTime: '2026-07-14T20:00:00Z',
      }),
    };
  },
});

// 2. Mock a GitHub plugin showing a recent PR that altered memory allocation
const mockGithubCommitFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'github.service' }),
  deps: {},
  async factory() {
    return {
      getRecentPRsAndCommits: async (repoSlug: string, sinceDate: string) => [
        {
          id: '#402',
          title: 'perf: Adjust Node max-old-space-size to 512MB',
          author: 'dev-alpha',
          mergedAt: '2026-07-14T19:45:00Z', // Merged just 15 mins prior to incident
        },
      ],
    };
  },
});

// 3. Execute the LangGraph workflow test
describe('Incident Triage Assistant Graph Execution', () => {
  it('should route through the OOMKilled investigation graph and flag the memory constraint PR', async () => {
    const { server } = await startTestBackend({
      features: [
        kubernetesAiResponderPlugin(),
        mockK8sIncidentFactory(),
        mockGithubCommitFactory(),
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

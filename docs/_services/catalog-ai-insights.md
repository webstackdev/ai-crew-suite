---
plugin_name: catalog-ai-insights
category: Catalog
subcategory: Knowledge
---

# Catalog AI Insights

- **The Task:** Answering contextual questions about any service in the Software Catalog (_"Who is the on-call?"_, _"Where are the logs?"_, _"Why did this service fail its last deployment?"_).
- **The Logic:** An agent "reads" a service's catalog metadata, recent deployments, and linked monitoring dashboards to synthesize answers in natural language.
- **Framework:** **RAG-based Agent** (either framework) backed by a vector store of catalog metadata and operational docs.

## Dependencies & Mock Targets

Because this plugin synthesizes real-time operational context (metadata, deployment status, logs, ownership), it acts as an aggregator over multiple core surfaces. You will need to mock three distinct layers in tests:

### 1. Core Backstage Services (`coreServices`)

- **`coreServices.discovery`**: Used to resolve internal service URLs for other backend plugin endpoints.
- **`coreServices.auth` / `httpAuth`**: Necessary to authenticate background agent requests when your plugin calls out to sibling plugins.

### 2. Sibling Plugins (Catalog & Ops Ecosystem)

Instead of hitting physical REST endpoints, mock the TypeScript internal interfaces or entity structures exposed by these foundational plugins:

- **`CatalogBackend` / `CatalogService`**: Provides the structural target data. The agent relies heavily on reading specific entity metadata tags like `backstage.io/kubernetes-id`, `://pagerduty.com`, or `://github.com`.
- **`KubernetesBackend` / `KubernetesService`**: The source for answering _"Why did this service fail its last deployment?"_. The agent needs to examine the pod states, event streams, or deployment objects retrieved by this plugin.
- **PagerDuty / Opsgenie Plugin Interfaces**: Provides the source data for _"Who is the on-call?"_.
- **Datadog / New Relic / Splunk Plugins**: Provides dashboard links or recent error log anomalies.

### 3. Internal RAG AI Platform

- **`knowledge.retrieve` Tool**: The primary vehicle for RAG. You will need to mock the vector search pipeline to return simulated chunks of operational documentation or historical catalogs.
- **PostgreSQL / pgvector Storage**: The stateful engine backing the agent sessions, runs, steps, and artifacts.

## Testing Strategy

Leverage `@backstage/backend-test-utils` combined with custom mock implementations of the operational service layers.

### Mocking the Dynamic Operational Context

Because your agent relies on changing data over time (e.g., a deployment transitioning from success to failure), you should write a **Stateful Custom Mock Factory** for the Kubernetes and monitoring dependencies.

Here is how you inject a mocked Kubernetes layer into your `startTestBackend` matrix to verify your agent's reasoning capability:

```typescript
import { createServiceFactory } from '@backstage/backend-plugin-api';
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import { catalogAiInsightsPlugin } from '../plugin';

// 1. Define a mock service that mimics a failing Kubernetes deployment
const mockKubernetesServiceFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'kubernetes.service' }), // Substitute with your K8s node service ref
  deps: {},
  async factory() {
    return {
      getPipelineStatus: async (componentName: string) => {
        if (componentName === 'failing-service') {
          return {
            pods: [
              {
                name: 'api-pod-xyz',
                status: 'CrashLoopBackOff',
                restartCount: 12,
              },
            ],
            events: [
              {
                message: 'Back-off restarting failed container',
                reason: 'FailedSync',
              },
            ],
          };
        }
        return {
          pods: [{ name: 'api-pod-abc', status: 'Running', restartCount: 0 }],
        };
      },
    };
  },
});

// 2. Execute the test runner
describe('Catalog AI Insights Agent', () => {
  it('should synthesize a natural language explanation for a failing deployment', async () => {
    const { server } = await startTestBackend({
      features: [
        catalogAiInsightsPlugin(),
        mockKubernetesServiceFactory(),
        // Seed the test catalog with the necessary annotations
        mockServices.catalog.factory({
          entities: [
            {
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              metadata: {
                name: 'failing-service',
                annotations: {
                  'backstage.io/kubernetes-id': 'failing-service-k8s',
                },
              },
              spec: { type: 'service', owner: 'team-alpha' },
            },
          ],
        }),
        // Provide mock configuration for LLM policies
        mockServices.rootConfig.factory({
          data: { ai: { policies: { defaultModel: 'mock-llm' } } },
        }),
        // Use an automatically cleaned up in-memory DB for runs and steps
        mockServices.database.factory(),
      ],
    });

    // Fire a request directly into your plugin's HTTP route using your test framework (e.g. supertest)
    // and assert that the agent used the K8s tool to find the 'CrashLoopBackOff' state.
  });
});
```

### Testing the `knowledge.retrieve` Tool in Isolation

To keep your RAG layer deterministic during tests, mock the retriever interface directly. Do not connect to a real `pgvector` database container for standard test cycles.

Instead, configure the vector database tool proxy to return pre-baked data chunks depending on the string match of the agent's generated prompt query. This ensures you are validating your prompt construction logic without relying on erratic or non-deterministic LLM behavior.

### Simulating Continuous Multi-Step Runs

Because your platform supports stateful orchestration and cyclic workflows, utilize `mockServices.scheduler` to test trigger-based insight collection (e.g., an agent scanning the catalog every night to proactively post Slack alerts for failing services). The `scheduler` mock allows you to fast-forward time ticks programmatically, causing your cron routines to run immediately inside the test lifecycle

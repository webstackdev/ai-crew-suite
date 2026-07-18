---
plugin_name: search-ai-context
category: Other
subcategory: Developer Productivity
---

# Cross-Service Search

- **The Task**: Resolving complex, multi-entity architectural dependencies and impact analysis queries that standard keyword or isolated-file searches cannot handle.
- **The Logic**: A **Stateful Graph Investigation Agent** combines semantic text retrieval (`knowledge.retrieve`) over the Backstage Software Catalog with active tool calls to upstream repositories. When an engineering mutation occurs (such as an API deprecation), a multi-agent loop evaluates catalog ownership relationships (`dependsOn`), runs static validation checks across downstream consumer repos via the **GitHub/GitLab tool pack**, and generates an actionable **Impact Assessment Artifact** summarizing exactly which components and teams will be broken.
- **Framework**: **LangGraph / Stateful Orchestrator** leveraging `knowledge.retrieve`, the Backstage entity graph, and live VCS code execution tools.

## Dependencies & Mock Targets

This assistant operates a **highly collaborative read-and-validate loop**. It is triggered either by an on-demand engineer query or automatically by an upstream API change event. It maps out dependencies across your internal software ecosystem and performs live verification steps on downstream consumer codebases.

### 1. Core Backstage Services (`coreServices`)

- **`coreServices.discovery`**: Vital for locating the endpoint URLs of sibling backend plugins (e.g., Catalog, Github) so the agent can choreograph its tool execution calls.
- **`coreServices.database`**: Manages the persistent session states, LangGraph run checkpoints, token/cost auditing metrics, and stores finalized **Impact Assessment Artifacts** for frontend viewing.
- **`coreServices.events`**: Listens for incoming event payloads (such as an API deprecation notice emitted by a central architecture board or a shared schema registry update).

### 2. Sibling Plugins & Data Sources

- **`CatalogBackend` / `CatalogService`**: The core source for dependency resolution. The agent explicitly uses this plugin to crawl relationship edges like `dependsOn`, `providesApi`, and `dependencyOf` to build the initial consumer list.
- **`knowledge.retrieve` Tool**: Wrapped inside the agent's graph to provide semantic retrieval capabilities over documentation, architectural RFCs, and API schemas.
- **`GithubBackend` / `GithubService` (or GitLab equivalents)**: Used by the static validation nodes to execute localized repository searches or pull down specific consumer files to verify if they make use of the deprecated API fields.

## Testing Strategy

The **LangGraph** flow maps this out as a structural **Stateful Graph Investigation Network** (Crawl Catalog → Build Component Graph → Run VCS Static Validation Checks → Emit Impact Artifact).

Your integration tests must verify that the graph accurately traverses nested, multi-tier dependency chains (e.g., Service A depends on API B, which depends on Component C) and correctly maps out the ultimate team owners.

```text
(a) Crawl Catalog ─> (b) Build Component Graph ─> Run VCS Static Validation ─> Emit Impact Artifact
(a) Extracts top-level    (b) Recursively crawls multi-tier
    entity relationships      dependency tree mappings
```

### 1. Simulating Graph Graph Traversals & VCS Checks

You need to verify that when a parent API is flagged as deprecated, the _Crawl Catalog_ node extracts the downstream consumer targets, and the _VCS Validation_ node scans the matching repositories to detect breaking changes.

Inject these dependencies into your Backstage backend test harness using custom service factories:

```typescript
import {
  createServiceFactory,
  createServiceRef,
} from '@backstage/backend-plugin-api';
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import { crossServiceSearchPlugin } from '../plugin';

// 1. Mock the GitHub plugin to return mock consumer source code code strings
const mockGithubValidationFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'github.service' }),
  deps: {},
  async factory() {
    return {
      searchCodeInRepository: async (
        repoSlug: string,
        searchString: string,
      ) => {
        if (repoSlug === 'org/downstream-consumer-one') {
          // This repo actively imports the deprecated endpoint string
          return {
            matches: [
              {
                path: 'src/client.ts',
                line: 42,
                text: `fetch('${searchString}')`,
              },
            ],
          };
        }
        // This repo matches the catalog dependency but doesn't hit the specific sub-route
        return { matches: [] };
      },
    };
  },
});

// 2. Execute the LangGraph investigation workflow validation
describe('Cross-Service Search LangGraph Execution', () => {
  it('should recursively crawl dependencies and correctly identify active code-level impact targets', async () => {
    const { server } = await startTestBackend({
      features: [
        crossServiceSearchPlugin(),
        mockGithubValidationFactory(),
        mockServices.catalog.factory({
          // Provide structural multi-entity dependency relationships
          entities: [
            {
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              metadata: {
                name: 'core-payment-api',
                annotations: { '://github.com': 'org/core-payment' },
              },
              spec: { type: 'api', owner: 'team-finance' },
            },
            {
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              metadata: {
                name: 'consumer-service-one',
                annotations: { '://github.com': 'org/downstream-consumer-one' },
              },
              spec: {
                type: 'service',
                owner: 'team-checkout',
                dependsOn: ['component:default/core-payment-api'],
              },
            },
            {
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              metadata: {
                name: 'consumer-service-two',
                annotations: { '://github.com': 'org/downstream-consumer-two' },
              },
              spec: {
                type: 'service',
                owner: 'team-marketing',
                dependsOn: ['component:default/core-payment-api'],
              },
            },
          ],
        }),
        mockServices.database.factory(), // Captures the resulting Impact Assessment Artifact
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    // Step A: Trigger the multi-agent search via a POST route request simulating an API mutation check.
    // Step B: Assert that the LangGraph runtime executes code verification steps for BOTH downstream services.
    // Step C: Query the database to extract the generated "Impact Assessment Artifact".
    // Step D: Confirm that the artifact flags 'consumer-service-one' as BROKEN, but lists 'consumer-service-two' as UNAFFECTED.
  });
});
```

### 2. Validating State Persistence of Complex Artifacts

Because analyzing massive organization-wide dependency trees can be highly time-consuming, ensure that your LangGraph checkpoints successfully preserve state across complex runs. Test that if a network glitch occurs during the VCS validation phase of repository #12 out of 50, your `PostgresSaver` can completely resume the execution context from the exact node boundary without initiating a fresh scan of the entire Backstage Software Catalog.

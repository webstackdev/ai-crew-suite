---
plugin_name: rfc-adr-ai-reviewer
category: Other
subcategory: Developer Productivity
---

# RFC & Architectural Decision Reviewer

- **The Task**: Providing automated, multi-perspective architectural and security gate feedback on new internal RFCs or Architecture Decision Records (ADRs) submitted across the engineering org.
- **The Logic**: When a new design document or ADR is detected (via a repository PR or a Backstage Software Template execution), a **Stateful Multi-Agent Review Loop** initializes. A **"Senior Architect" Agent Node** extracts the system design proposals and uses `knowledge.retrieve` to cross-reference them against live catalog dependencies and active API schemas. Concurrently, a **"Security Lead" Agent Node** parses the document against enterprise compliance rules. The runtime leverages **SSE structured streaming** to display the agents' multi-turn feedback debate natively in the Backstage UI before generating a final **Design Critique Artifact** and opening an automated feedback issue/PR.
- **Framework**: **LangGraph / Stateful Orchestrator** utilizing `knowledge.retrieve`, multi-agent role collaboration, structured streaming, and the Backstage entity graph.

## Dependencies & Mock Targets

This assistant runs an **asynchronous, multi-perspective evaluation loop**. It acts as an automated governance gate that intercepts architectural proposals before they are finalized, ensuring alignment with corporate standards and system schemas.

### 1. Core Backstage Services (`coreServices`)

- **`coreServices.events`**: Catches Git repository webhook notifications (like a PR opening with changes in an `adr/` directory) or template creation events from the Software Scaffolder.
- **`coreServices.database`**: Powers the LangGraph `PostgresSaver` checkpointer to log multi-turn agent execution states, token costs, and the resulting critique data.
- **`coreServices.httpRouter`**: Establishes the SSE (Server-Sent Events) endpoint to stream the interactive critique debate to the frontend client.

### 2. Sibling Plugins & Data Sources

- **`CatalogBackend` / `CatalogService`**: Provides the graph-validation target data. The "Senior Architect" agent uses this service to verify if the components or dependencies referenced in the RFC actually exist or are marked as deprecated.
- **`knowledge.retrieve` Tool**: Ingests cross-organizational standards, security policies, compliance whitepapers, and existing ADRs to provide context boundaries for the critique.
- **`GithubBackend` / `GithubService` (or GitLab equivalents)**: Used to write markdown comments directly to the open Pull Request or file trackable issues against the design repository.

## Testing Strategy

The **LangGraph** architecture implements a parallel execution graph (Senior Architect Node + Security Lead Node running concurrently) that pushes critique outputs into a shared state channel, which a third compilation node evaluates to produce a finalized **Design Critique Artifact**.

```text
                    ┌───────────────────────────┐
                    │  Trigger: New ADR / RFC   │
                    └─────────────┬─────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
     ┌────────────────────────┐      ┌────────────────────────┐
     │ Senior Architect Node  │      │   Security Lead Node   │
     └────────────┬───────────┘      └────────────┬───────────┘
       Cross-references catalog        Parses document against
       & live API definitions          compliance regulations
                  │                               │
                  └───────────────┬───────────────┘
                                  ▼
                    ┌───────────────────────────┐
                    │ Compilation Node (Merge)  │
                    └─────────────┬─────────────┘
                                  ▼
                    ┌───────────────────────────┐
                    │  Design Critique Artifact │
                    └───────────────────────────┘
```

### 1. Simulating Parallel Execution and Structural Consensus

You need to verify that your LangGraph handles parallel branches gracefully. If the Senior Architect node raises a schema conflict and the Security Lead node simultaneously identifies a compliance flaw, the shared state must merge both nodes' items before triggering the final compilation layer.

Inject these dependencies into your Backstage backend test harness using custom service factories:

```typescript
import {
  createServiceFactory,
  createServiceRef,
} from '@backstage/backend-plugin-api';
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import { rfcAdrAiReviewerPlugin } from '../plugin';

// 1. Mock the GitHub plugin to provide the source markdown of an incoming ADR
const mockGithubPrFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'github.service' }),
  deps: {},
  async factory() {
    return {
      getPrFileContent: async () => `
        # ADR-005: Use Shared Payment Cluster
        We propose shifting our core billing traffic over to the 'deprecated-legacy-vault' API
        without initializing transport-layer token rotation.
      `,
      postPrComment: async (prId: string, commentMarkdown: string) => ({
        status: 'COMMENT_POSTED_201',
      }),
    };
  },
});

// 2. Execute the multi-agent parallel LangGraph validation
describe('RFC & ADR Reviewer LangGraph Parallel Execution', () => {
  it('should run concurrent evaluations and merge critique signals into the final artifact', async () => {
    const { server } = await startTestBackend({
      features: [
        rfcAdrAiReviewerPlugin(),
        mockGithubPrFactory(),
        mockServices.catalog.factory({
          entities: [
            {
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              metadata: { name: 'deprecated-legacy-vault' },
              spec: { type: 'api', lifecycle: 'deprecated' }, // Marked as deprecated to trigger the architect node
            },
          ],
        }),
        mockServices.database.factory(), // Tracks parallel checkpoint states
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    // Step A: Emit a simulated repository event payload via an HTTP POST into your plugin router using supertest.
    // Step B: Assert that the LangGraph splits into parallel execution pipelines.
    // Step C: Inspect the database to verify the merged state contains flags for BOTH a deprecation error and a security token error.
    // Step D: Confirm that the final execution state writes a comprehensive critique summary block back to the PR mock.
  });
});
```

### 2. Validating SSE Structured Streaming Output

Because this plugin streams multi-turn agent debates over an SSE pipeline to optimize developer engagement, testing the serialization interface is essential.

Write an execution test that hits the streaming path. Use a test client helper to subscribe to the event stream, then assert that the streamed blocks conform to your platform’s structured data pattern—explicitly returning separate text segments tagged for `node:senior-architect` and `node:security-lead` as the graph processes each parallel path.

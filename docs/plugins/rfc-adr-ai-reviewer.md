---
layout: default
title: RFC & Architectural Decision Reviewer
parent: Other
plugin_name: plugin-ai-agent-backend-rfc-adr-ai-reviewer
subcategory: Developer Productivity
---

# RFC & Architectural Decision Reviewer

{: .no_toc }

<span class="label label-blue">{{ page.subcategory }}</span>

---

## Overview

This plugin automatically parses Request for Comments (RFCs) and Architecture Decision Records (ADRs) to flag design pattern deviations, security anomalies, and dependency mismatches.

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

Write an execution test that hits the streaming path. Use a test client helper to subscribe to the event stream, then assert that the streamed blocks conform to your platform's structured data pattern—explicitly returning separate text segments tagged for `node:senior-architect` and `node:security-lead` as the graph processes each parallel path.

## Frontend



## Backend Completed

Implemented the RFC/ADR reviewer backend module at:

`/home/kevin/Repos/backstage/ai-crew-suite/plugins/backend/plugin-ai-agent-backend-rfc-adr-ai-reviewer`

## Implemented: read-only parallel-review milestone

The module now provides a custom AI Core workflow runner:

- Workflow ID: `rfc-adr-review`

- Agent ID: `rfc-adr-ai-reviewer`

- Manual trigger registration

- Read-only tool allow-list:

  - `vcs.repository.read_file`
  - `vcs.repository.get_metadata`
  - `compliance.architecture.validate`
  - `compliance.policy.evaluate`
  - `knowledge.retrieve`

### Workflow behavior

1. Validates one RFC/ADR request:

   - repository URL
   - `adr/` or `rfc/` document path
   - optional ref / pull-request ID

2. Reads and redacts the document with a configurable size cap.

3. Runs two independent review channels concurrently with `Promise.all`:

   - __Senior Architect__: standards retrieval and architecture/deprecation findings
   - __Security Lead__: architecture/compliance policy findings

4. Emits independently tagged workflow steps:

   - `senior-architect`
   - `security-lead`
   - `compilation`

5. Deterministically merges cited findings and derives the verdict:

   - `block` for critical/high findings
   - `comment` for lower-severity findings
   - `approve` when no cited findings remain

6. Emits a replayable `design-critique` artifact.

## Safety and current contract limitations

The implementation plan correctly identifies three missing shared contracts:

- `vcs.pull_request.comment` write tool
- `CatalogEntityResolver`
- confirmed event-service subscription integration

Those features were __not fabricated__.

The current module is explicitly:

- read-only
- manual-triggered
- draft-only
- advisory

If `publish.enabled` is configured, the critique records a limitation explaining that PR commenting is unavailable. It does not emit a fake approval request or attempt a PR mutation.

## JSDoc and formatting

New source files include:

- Apache 2026 license headers
- JSDoc for exported types, classes, functions, configuration, artifacts, and workflow contracts
- readable named helpers for request parsing, document redaction, reference extraction, verdict derivation, and bounded tool execution

## Wiring added

Registered the module in:

- `/home/kevin/Repos/backstage/ai-crew-suite/tsconfig.json`
- `/home/kevin/Repos/backstage/ai-crew-suite/.eslintrc.cjs`
- `/home/kevin/Repos/backstage/ai-crew-suite/packages/backend/package.json`
- `/home/kevin/Repos/backstage/ai-crew-suite/packages/backend/src/index.ts`
- `/home/kevin/Repos/backstage/ai-crew-suite/app-config.yaml`
- `/home/kevin/Repos/backstage/ai-crew-suite/yarn.lock`

## Tests added

- Merge findings from both channels and derive a blocking verdict from high severity
- Extract component/API references and redact secret-like document values
- Module registration, workflow ID, agent profile, and manual trigger coverage

## Validation completed

Passed:

- `yarn workspace @webstackbuilders/plugin-ai-agent-backend-rfc-adr-ai-reviewer test`
  - __3 tests passed__
- Package TypeScript compilation
- Package lint
- `yarn typecheck --force`
  - __48/48 tasks successful__
- `yarn lint --force`
  - __48/48 tasks successful__; existing unrelated warning-only findings remain
- `git diff --check`

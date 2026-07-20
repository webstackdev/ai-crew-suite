---
layout: default
title: Institutional Knowledge Finder
parent: Other
plugin_name: search-ai-archeology
subcategory: Developer Productivity
---

# Institutional Knowledge Finder

{: .no_toc }

<span class="label label-blue">{{ page.subcategory }}</span>

---

## Overview

This plugin acts as a semantic search engine across deprecated spaces, legacy wikis, and historical repositories, digging up context and documentation that keyword search engines miss.

- **The Task**: Identifying active subject matter experts and uncovering lost historical tribal knowledge across shifting organizational structures.
- **The Logic**: Instead of running expensive, noisy vector embeddings over millions of historical code diffs, a **Multi-Tool Research Agent** executes a hybrid search. It uses `knowledge.retrieve` over high-level TechDocs and Architecture Decision Records (ADRs) to isolate target files and components. It then invokes time-bounded queries via the **GitHub and Jira tool packs** (e.g., historical `git blame` logs and ticket histories from specific eras) to calculate an **Expertise Matrix Artifact**, tracking down the original authors and code reviewers regardless of current catalog ownership.
- **Framework**: **LangGraph / Stateful Orchestrator** blending semantic vector lookups with deterministic VCS/Jira tool tracking and Backstage Org Graph cross-referencing.

## Dependencies & Mock Targets

This assistant runs a **deep historical diagnostic research workflow**. Rather than continuously indexing massive quantities of historical code diffs, it targets specific operational signals by orchestrating semantic vector text parsing alongside deterministic VCS logs.

### 1. Core Backstage Services (`coreServices`)

- **`coreServices.identity` / `httpAuth`**: Validates the authentication scope of the user querying the archaeology interface to prevent unauthorized access to legacy tracking systems.
- **`coreServices.database`**: Backs the persistent session layers, LangGraph runtime checkpoints, token/cost budgets, and stores the final **Expertise Matrix Artifact** for instant retrieval on the Backstage frontend interface.
- **`coreServices.urlReader`**: Utilized by the initial node to scan structural workspace targets, such as checking file trees for an architectural `/docs/adr/` directory or parsing root configuration files.

### 2. Sibling Plugins & Data Sources

- **`CatalogBackend` / `CatalogService`**: Crucial for mapping historical git metadata to modern identity assets. The agent queries the catalog specifically for `User` and `Group` entities (the Org Graph) to translate stale commit authors into current active corporate teams.
- **`knowledge.retrieve` Tool**: Extracted inside the graph to run semantic string matches against TechDocs repositories and ADR text logs.
- **`GithubBackend` / `GithubService` (or GitLab)**: Used by the toolpack layer to issue localized, time-bounded commands like extracting a `git blame` matrix or pulling PR code review participant trails from a specific year.
- **Jira / Linear Plugins**: Used to query old ticket comment histories and assignee loops attached to legacy component identifiers.

## Testing Strategy

The **LangGraph** workflow maps this out as a multi-stage network: _Isolate Target Files → Query Historical VCS Logs → Cross-Reference Org Graph → Generate Expertise Matrix_.

Your integration tests must verify that the graph accurately handles edge cases like encountering a deactivated user account or resolving a legacy corporate email format without throwing an unhandled exception or breaking the state channel sequence.

```text
  ┌─────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
  │ Isolate Target Files│ ───> │ Query Historical Logs   │ ───> │ Cross-Reference Org    │
  └─────────────────────┘      └─────────────────────────┘      └────────────┬────────────┘
   Vector / URL lookups         Time-bounded git blame &                     │
   to narrow down files         Jira ticket tracking profiles                ▼
                                                                ┌─────────────────────────┐
                                                                │ Generate Expertise Mat. │
                                                                └─────────────────────────┘
```

### 1. Simulating Historical Diffs and Account Verification

You need to verify that when the _Query Historical Logs_ node receives a file path, it cleanly parses commit authors and correctly traces those identities against the modern Catalog Org Graph.

Inject these dependencies into your Backstage backend test harness using custom service factories:

```typescript
import {
  createServiceFactory,
  createServiceRef,
} from '@backstage/backend-plugin-api';
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import { searchAiArcheologyPlugin } from '../plugin';

// 1. Mock the GitHub toolpack to return a deterministic git blame payload
const mockGithubArcheologyFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'github.service' }),
  deps: {},
  async factory() {
    return {
      getFileBlameHistory: async (repo: string, path: string) => [
        {
          commitId: 'a8f1b2',
          authorEmail: 'retired-dev@company.com',
          date: '2022-04-12',
          lines: '1-50',
        },
        {
          commitId: 'c3e4d5',
          authorEmail: 'active-lead@company.com',
          date: '2025-06-30',
          lines: '51-60',
        },
      ],
    };
  },
});

// 2. Execute the LangGraph workflow validation
describe('Institutional Knowledge Finder LangGraph Execution', () => {
  it('should resolve legacy authors against the active Org Graph and compile the Expertise Matrix', async () => {
    const { server } = await startTestBackend({
      features: [
        searchAiArcheologyPlugin(),
        mockGithubArcheologyFactory(),
        mockServices.catalog.factory({
          // Seed the catalog with modern day User and Group identities
          entities: [
            {
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'User',
              metadata: { name: 'active-lead', title: 'Active Tech Lead' },
              spec: {
                profile: { email: 'active-lead@company.com' },
                memberOf: ['team-core-infra'],
              },
            },
            // Notice: 'retired-dev' is omitted entirely to simulate an offboarded employee
          ],
        }),
        mockServices.database.factory(), // Caches compiled Expertise Matrix Artifacts
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    // Step A: Request historical context via an HTTP POST request to the plugin route using supertest.
    // Step B: Assert that the LangGraph evaluates both VCS data and active catalog records.
    // Step C: Fetch the generated "Expertise Matrix Artifact" from the database.
    // Step D: Confirm that 'active-lead' is flagged as a prime expert (Team: core-infra),
    //         while 'retired-dev' is gracefully recorded as a "Deactivated/Legacy Contributor".
  });
});
```

### 2. Validating State Resiliency Across Deep Tool Runs

Because digging through complex historical code repositories can occasionally hit GitHub/Jira API rate limits, ensure your LangGraph state checkpoint manager is completely robust. Use your testing harness to confirm that if your GitHub tool pack encounters a simulated `429 Rate Limit Exceeded` exception mid-run, your graph safely saves its step context using `PostgresSaver` and can seamlessly resume execution from that exact node boundary once the rate window clears.

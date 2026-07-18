---
plugin_name: scaffolder-ai-prd
category: Scaffolder
subcategory: Product & Delivery
---

# Product Requirements Translator

- **The Task**: Transforming a raw Product Requirement Document (PRD) into a comprehensive, multi-entity project footprint spanning ticketing, code repositories, and documentation.
- **The Logic**: When a user submits a PRD, a stateful LangGraph multi-agent network distributes the work to specialized node agents. The **Product Manager node** translates product specs into structured Jira Epics and Stories, the **Engineer node** parses technical mandates to determine which Backstage Software Templates to configure, and the **Technical Writer node** generates the baseline architectural documentation. The execution automatically freezes at a persistent database checkpoint for engineering lead sign-off before executing any write operations across external tools.
- **Framework**: **LangGraph** leveraging a parallel multi-agent graph layout, shared state aggregation channels, and a stateful human-in-the-loop (HITL) approval path.

## Dependencies & Mock Targets

Because this plugin coordinates writing tasks across multiple distinct external enterprise domains simultaneously, mocking the network wire using tools like WireMock would be exceptionally complex. Instead, intercept the data models directly at the Backstage plugin and service layer boundary.

### 1. Core Backstage Services (`coreServices`)

- **`coreServices.database`**: Powers the LangGraph `PostgresSaver` checkpointer. It captures the complex state of the parallel runs and securely stages the multi-entity generation blueprints while waiting for user approval.
- **`coreServices.httpRouter`**: Establishes the Server-Sent Events (SSE) streaming paths to broadcast live tracking updates as the PM, Engineer, and Writer nodes execute their respective analytical steps in parallel.
- **`coreServices.discovery`**: Dynamically maps internal paths to orchestrate API calls into the local Scaffolder engine.

### 2. Sibling Plugins & Data Sources

- **`ScaffolderBackend` / `ScaffolderService`**: Targeted by the Engineer node to programmatically trigger the creation of service codebases based on the chosen software template.
- **Jira / Linear Node Plugins**: Invoked by the PM node to create tracking buckets, map story points, and establish dependency lines.
- **`TechDocsBackend` / `UrlReader`**: Targeted by the Technical Writer node to seed the new component's root documentation repository with foundational markdown structures.

## Testing Strategy

The **LangGraph** flow routes execution through a fork-join network (_Parse PRD \(\rightarrow \) Fork into Concurrent Nodes \(\rightarrow \) Join & Aggregate State \(\rightarrow \) Human Approval Gate \(\rightarrow \) Commit Actions_). Your integration testing must prove that parallel node states merge cleanly, and that no external API write actions occur while the graph is paused at the checkpoint.

```text
                        ┌───────────────────────────┐
                        │     Trigger: Parse PRD    │
                        └─────────────┬─────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
     ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
     │ PM Agent Node    │    │  Engineer Node   │    │  Doc Agent Node  │
     └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
      Compiles Jira ticket    Maps Scaffolder         Drafts Technical
      structures & fields     template choices        Markdown files
              │                       │                       │
              └───────────────────────┼───────────────────────┘
                                      ▼
                        ┌───────────────────────────┐
                        │    State Aggregation      │ (Joins parallel results)
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │   [Human Approval Gate]   │ (Graph freezes/saves state)
                        └─────────────┬─────────────┘
                                      │ (Approved)
                                      ▼
                        ┌───────────────────────────┐
                        │ Commit: Jira/Scaffolder   │ (Executes final actions)
                        └───────────────────────────┘
```

### 1. Simulating State Aggregation and the Interruption Boundary

You need to verify that your graph accurately runs the initial parallel collection steps, aggregates the multi-agent outputs into a singular blueprint payload, and saves a durable database checkpoint without triggering external endpoints prematurely.

Inject your backend components into the `startTestBackend` matrix using standard service factories:

```typescript
import {
  createServiceFactory,
  createServiceRef,
} from '@backstage/backend-plugin-api';
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import { scaffolderAiPrdPlugin } from '../plugin';

// 1. Mock the Jira plugin to catch issue tracking payloads
const mockJiraTrackerFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'jira.service' }),
  deps: {},
  async factory() {
    return {
      createEpicWithStories: async (epicData: any) => {
        if (epicData.summary.includes('Authentication System Upgrade')) {
          return { epicKey: 'PROJ-501', status: 'CREATED' };
        }
        throw new Error(
          'Jira tool pack invoked with invalid or unapproved context data.',
        );
      },
    };
  },
});

// 2. Mock the Scaffolder service to track boilerplate orchestration triggers
const mockScaffolderTriggerFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'scaffolder.service' }),
  deps: {},
  async factory() {
    return {
      executeTemplateJob: async (templateId: string, params: any) => ({
        status: 'JOB_SPAWNED',
        jobId: 'job-999',
      }),
    };
  },
});

// 3. Test the transactional parallel LangGraph workflow
describe('Product Requirements Translator LangGraph Loop', () => {
  it('should split tasks concurrently, aggregate outputs, freeze for approval, and commit on resume', async () => {
    const { server } = await startTestBackend({
      features: [
        scaffolderAiPrdPlugin(),
        mockJiraTrackerFactory(),
        mockScaffolderTriggerFactory(),
        mockServices.database.factory(), // Backs the PostgresSaver checkpointer
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    // Step A: Post a raw PRD string ("Build a multi-factor auth system using our node template") via supertest.
    // Step B: Assert that the LangGraph splits execution across the PM, Engineer, and Writer nodes.
    // Step C: Verify that the graph halts and writes a 'PENDING_APPROVAL' state checkpoint to the database.
    // Step D: Confirm that neither the mock Jira nor mock Scaffolder tools have been called yet.
    // Step E: Fire an HTTP PUT command to the resume route; assert the graph wakes up, passes the approval boundary, and invokes both tool packs successfully.
  });
});
```

### 2. Validating State Merging on the Shared Channel

Because parallel agents update the shared graph context concurrently, you should include a test case that checks for race conditions or schema inconsistencies during the _Join & Aggregate State_ step. Use your shared `test-fixtures` utility to inspect the graph's transient state layout immediately prior to hitting the human approval gate. Assert that the `jiraBlueprint`, `scaffolderBlueprint`, and `documentationBlueprint` properties are all fully populated and grammatically structured, confirming your multi-agent collaboration functions correctly.

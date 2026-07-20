---
layout: default
title: Intent-Driven Scaffolder
parent: Scaffolder
plugin_name: scaffolder-ai-intent
subcategory: Golden Path Provisioning
---

# Intent-Driven Scaffolder

{: .no_toc }

<span class="label label-blue">{{ page.subcategory }}</span>

---

## Overview

This plugin analyzes natural language intent inputs from users to automatically select, pre-fill, and execute appropriate software template blueprints.

**Value**: High. Standard Scaffolder forms can suffer from field fatigue, often requiring complex regex validations and deep knowledge of enterprise parameter syntax.

**Optimization Strategy**: Shift this from a basic form-filler into a **Self-Healing Parameter Validator**. Instead of just guessing strings, your LangGraph orchestrator should parse the natural language, match it to the Scaffolder schema, and use your platform's **idempotency and validation loops** to test the inputs against live infrastructure rules (e.g., verifying if a requested service name is already taken in the Backstage Catalog) before prompting the user with a confirmation screen.

- **The Task:** Replacing manual Scaffolder forms with natural-language service requests.
- **The Logic:** A dev describes their needs in plain English. The agent selects the correct Software Template and pre-fills the parameters.
- **Framework:** **LangGraph** for the multi-step parsing, template selection, and confirmation flow.

## Dependencies & Mock Targets

This assistant operates a **highly synchronous, interactive user-facing loop**. It converts loose natural language input into strict, structured JSON schemas that comply with Backstage `Template` parameters, validating data primitives against real environment rules prior to execution.

### 1. Core Backstage Services (`coreServices`)

- **`coreServices.httpRouter`**: Sets up the synchronous endpoint or Server-Sent Events (SSE) streaming channel to deliver real-time validation checks back to the developer interface.
- **`coreServices.database`**: Stores the active conversation context, multi-turn validation checkpoints, and tracking keys across the interactive parameter-gathering sequence.
- **`coreServices.discovery`**: Locates internal plugin service paths to smoothly handle programmatic schema inspection tasks.

### 2. Sibling Plugins & Data Sources

- **`ScaffolderBackend` / `ScaffolderService`**: The primary operational integration point. The agent scans this plugin to query the array of registered `Template` schemas and programmatically trigger task runs after human validation is secured.
- **`CatalogBackend` / `CatalogService`**: Used as a live lookup target during the self-healing validation node to run pre-flight availability checks (e.g., verifying if a requested service name or component identifier is already claimed in the ecosystem registry).
- **Version Control tool packs (GitHub/GitLab)**: Used by the validation node to inspect infrastructure targets and make sure destination repository names or cloud keys are structurally valid.

## Testing Strategy

The **LangGraph** flow maps this out as a strict transactional graph: _Parse Natural Language → Select Template Match → Self-Healing Validation Loop → Render Human Confirmation Gate_.

Your integration tests must verify that when a parameter fails an infrastructure check (e.g., a service name collision), the graph loops backward to prompt for a correction instead of executing a broken Scaffolder step.

```text
  │ Parse Natural Language │ ───> │  Select Template Match  │
                                               │
                                               ▼
  │ Human Confirmation Gate│ <─── │ Self-Healing Valid. Loop│ <──┐
               │                               │                 │
               │ (Confirmed)                   └─(Name Taken)────┘
               ▼
  ┌────────────────────────┐
  │ Trigger Scaffolder Job │
  └────────────────────────┘
```

### 1. Simulating Interactive Parameter Correction Loops

You need to verify that your graph correctly identifies a namespace conflict in the catalog, appends a descriptive error state to its execution parameters, and stays in a self-healing retry node until an available name is provided.

Inject these dependencies into your Backstage backend test harness using custom service factories:

```typescript
import {
  createServiceFactory,
  createServiceRef,
} from '@backstage/backend-plugin-api';
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import { scaffolderAiIntentPlugin } from '../plugin';

// 1. Mock the Scaffolder plugin to return a strict registered software template schema
const mockScaffolderSchemaFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'scaffolder.service' }),
  deps: {},
  async factory() {
    return {
      getTemplateSchema: async (templateId: string) => ({
        id: 'react-service-template',
        required: ['componentId', 'owner'],
        properties: {
          componentId: { type: 'string' },
          owner: { type: 'string' },
        },
      }),
      executeTemplateJob: async (templateId: string, parameters: any) => ({
        status: 'JOB_SPAWNED_202',
        jobId: 'scaffolder-job-777',
      }),
    };
  },
});

// 2. Execute the self-healing parameter validation LangGraph test
describe('Intent-Driven Scaffolder LangGraph Validation', () => {
  it('should detect catalog collisions and loop parameters back for self-healing before execution', async () => {
    const { server } = await startTestBackend({
      features: [
        scaffolderAiIntentPlugin(),
        mockScaffolderSchemaFactory(),
        mockServices.catalog.factory({
          entities: [
            {
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              metadata: { name: 'payment-gateway' }, // Existing service name to trigger validation collision
            },
          ],
        }),
        mockServices.database.factory(), // Tracks conversational checkpoint loops
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    // Step A: Post a loose natural language input ("Create a react app called payment-gateway") via supertest.
    // Step B: Assert that the LangGraph maps the input to 'react-service-template'.
    // Step C: Verify that the graph loops through the validation node and catches the catalog naming conflict.
    // Step D: Confirm that the final state object flags the naming error and generates a structured prompt requesting a modified value, halting safely before triggering any Scaffolder jobs.
  });
});
```

### 2. Guarding the Transactional Confirmation Gate

Because spawning an infrastructure provisioning workflow carries real-world resource costs, ensure your LangGraph state-saving layer is perfectly secure. Verify that the execution runtime writes a durable database checkpoint using `PostgresSaver` upon completing successful validation loops. The graph must stay frozen in a `WAIT_FOR_CONFIRMATION` state, ensuring it never executes the final tool node until a user signature payload is received by the backend router.

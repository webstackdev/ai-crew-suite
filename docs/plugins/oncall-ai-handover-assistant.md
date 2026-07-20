---
layout: default
title: On-Call Handover Assistant
parent: Incident Response
plugin_name: oncall-ai-handover-assistant
subcategory: Reliability & Incident Management
---

# On-Call Handover Assistant

{: .no_toc }

<span class="label label-blue">{{ page.subcategory }}</span>

---

## Overview

This plugin automates the collection of shift events, unresolved alerts, and systemic notes to generate structured summary briefs for incoming on-call engineers.

- **The Task:** Briefing the incoming on-call engineer on the previous shift.
- **The Logic:** A **LangGraph** agent summarizes the most frequent alerts and service changes from the previous shift.
- **Framework:** **LangGraph** for the stateful aggregation and summarization flow.

## Dependencies & Mock Targets

This assistant operates as a **read-and-summarize scheduler or on-demand workflow**. It scans a trailing window of operational history (typically the last 12 to 24 hours) across your entire infrastructure workspace to surface patterns, anomalies, and active state alterations.

### 1. Core Backstage Services (`coreServices`)

- **`coreServices.scheduler`**: Triggers the handover graph automatically at predefined shift intervals (e.g., 08:00 and 16:00) to pre-compile the handover report artifact.
- **`coreServices.database`**: Records persistent run history, state variables, and token/cost metrics associated with compiling each shift report.
- **`coreServices.identity` / `httpAuth`**: Validates the identity of the incoming engineer requesting an on-demand briefing through the frontend UI.

### 2. Sibling Plugins & Data Sources

- **PagerDuty / Opsgenie Node Plugins**: Provides the volume of alerts, specific alert definitions, and paging event metadata triggered during the departing shift.
- **`KubernetesBackend` / `KubernetesService`**: Scanned by the agent to see what deployments, configuration changes, or scaling events occurred during the shift window.
- **`GithubBackend` / `GithubService`**: Scanned to pull a history of merged PRs, configuration-as-code changes, or emergency patches pushed to production.
- **Jira / Linear Plugins**: Used to check for outstanding high-severity incident tickets or ongoing production fire items still assigned to the on-call queue.

## Testing Strategy

Because this plugin utilizes **LangGraph** for a stateful aggregation and summarization flow, your validation strategy can leverage deterministic data passing inside a single loop. The graph's state schema will hold arrays of alerts, deployments, and tickets that build up node-by-node before passing to the final summarizer node.

### 1. Verification of the Aggregation Graph

You need to verify that if the _Alert Ingestion_ node pulls 50 paging alerts, the subsequent _Deduplication & Clustered Analysis_ node correctly groups them into distinct incident clusters before handing them over to the LLM summarizer node.

Using `@backstage/backend-test-utils`, you can inject high-volume mock metrics directly into the test environment:

```typescript
import {
  createServiceFactory,
  createServiceRef,
} from '@backstage/backend-plugin-api';
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import { oncallAiHandoverAssistantPlugin } from '../plugin';

// 1. Mock PagerDuty plugin interface to return a noisy alert history
const mockPagerDutyHistoryFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'pagerduty.service' }),
  deps: {},
  async factory() {
    return {
      getShiftAlerts: async (sinceTimestamp: string) => [
        {
          id: 'A1',
          service: 'catalog-service',
          title: 'High Error Rate 5xx',
          created_at: '2026-07-15T02:00:00Z',
        },
        {
          id: 'A2',
          service: 'catalog-service',
          title: 'High Error Rate 5xx',
          created_at: '2026-07-15T02:05:00Z',
        },
        {
          id: 'A3',
          service: 'db-pool',
          title: 'Connection Timeout',
          created_at: '2026-07-15T04:12:00Z',
        },
      ],
    };
  },
});

// 2. Mock Jira plugin interface to pull unassigned high-pri tickets
const mockJiraTicketFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'jira.service' }),
  deps: {},
  async factory() {
    return {
      getActiveIncidentTickets: async (teamId: string) => [
        {
          key: 'OPS-911',
          summary: 'Investigate memory leaks on payment-gateway',
          status: 'In Progress',
        },
      ],
    };
  },
});

// 3. Test the LangGraph execution block
describe('On-Call Handover Assistant LangGraph Loop', () => {
  it('should cleanly aggregate active alerts, track ticket items, and output an active run context', async () => {
    const { server } = await startTestBackend({
      features: [
        oncallAiHandoverAssistantPlugin(),
        mockPagerDutyHistoryFactory(),
        mockJiraTicketFactory(),
        mockServices.database.factory(), // Tracks persistent operational handover runs
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    // Step A: Trigger an on-demand shift brief compile via a mock router client GET request.
    // Step B: Assert that the LangGraph runtime executes all collection nodes sequentially.
    // Step C: Verify that your cost accounting table records the exact token usage metrics for this execution step.
    // Step D: Confirm that the output object explicitly merges data structures from both Jira and PagerDuty channels.
  });
});
```

### 2. Testing Cron-Triggered Executions

Since these reports are typically compiled right before a shift change occurs, verify your scheduler integration. By using `mockServices.scheduler.factory()`, you can instantly invoke the scheduled background task inside your Jest run. Assert that the execution successfully builds the LangGraph state context, invokes your custom toolpacks, and drops the generated summary straight into your PostgreSQL caching layer so it loads instantly when the incoming engineer clicks into Backstage.

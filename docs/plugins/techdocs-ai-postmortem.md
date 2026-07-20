---
layout: default
title: Post-Mortem Timeline Author
parent: Incident Response
plugin_name: techdocs-ai-postmortem
subcategory: Reliability & Incident Management
---

# Post-Mortem Timeline Author

{: .no_toc }

<span class="label label-blue">{{ page.subcategory }}</span>

---

## Overview

This plugin aggregates timeline sequences from Slack channels, incident management systems, and monitoring platforms to automatically draft comprehensive post-mortem incidents.

- **The Task**: Drafting post-incident timelines automatically inside Backstage TechDocs.
- **The Logic**: Following a PagerDuty resolution event, a stateful LangGraph multi-agent network (Log Gatherer node \(\rightarrow \) Timeline Writer node) queries Datadog metrics, GitHub PR histories, and Slack transcripts to compile a sequential "Timeline of Events." It halts at an in-memory or database checkpoint for human approval before committing the final Markdown document.
- **Framework**: **LangGraph** utilizing a multi-agent state graph, a shared state channel, and persistent PostgreSQL checkpoints.

## Dependencies & Mock Targets

### 1. Core Backstage Services (`coreServices`)

- **`coreServices.urlReader`**: Used by the graph's committing node to inspect target source directories or verify `mkdocs.yml` configurations before submitting updates.
- **`coreServices.database`**: Powers the LangGraph `PostgresSaver` checkpoint manager. It freezes graph state during human-in-the-loop validation intervals and logs execution runs/steps for frontend streaming.
- **`coreServices.events`**: Catches `PagerDuty` incident resolution hooks flowing through the central Backstage backend event bus.

### 2. Sibling Plugins & Data Sources

- **`TechDocsBackend` / `TechDocsService`**: Coordinates where the component's markdown source files live in the underlying git infrastructure.
- **PagerDuty / Opsgenie Node Plugins**: Provides the baseline incident metrics (start/end timestamps, team assignment, core responder notes).
- **Datadog / Splunk Plugins**: Extracted by the Log Gatherer node to identify error spikes or alert triggers.
- **Slack Plugin Interface**: Provides contextual team message transcripts.

## Testing Strategy

By maintaining **LangGraph** as your single orchestration layer, you can test this workflow deterministically using native checkpoint state inspections instead of simulating the entire multi-agent runtime over network sockets.

### 1. Intercepting the Multi-Agent State Flow

You can validate that the Log Gatherer node correctly pushes fetched data into the shared LangGraph state channel, and that the Timeline Writer node successfully consumes it.

Inject these dependencies into your Backstage backend test harness using custom service factories:

```typescript
import {
  createServiceFactory,
  createServiceRef,
} from '@backstage/backend-plugin-api';
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import { techdocsAiPostmortemPlugin } from '../plugin';

// 1. Mock Slack plugin interface to return static message arrays
const mockSlackServiceFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'slack.service' }),
  deps: {},
  async factory() {
    return {
      getChannelHistory: async (channelId: string, sinceDate: string) => [
        {
          ts: '1689363900',
          user: 'dev-alpha',
          text: 'Investigating database spike right now.',
        },
        {
          ts: '1689364500',
          user: 'dev-beta',
          text: 'Applied hotfix patch to production.',
        },
      ],
    };
  },
});

// 2. Mock UrlReader to capture the final commit action
const mockUrlReaderFactory = mockServices.urlReader.factory({
  extraReaders: [
    {
      canRead: url =>
        url.host === 'github.com' && url.pathname.includes('docs/postmortems'),
      read: async () => Buffer.from('# Post-Mortems\n'),
      readUrl: async () => ({ buffer: async () => Buffer.from('') }),
    },
  ],
});

// 3. Test the LangGraph execution flow and checkpoint system
describe('Post-Mortem Timeline LangGraph Workflow', () => {
  it('should compile context, save a checkpoint for approval, and resume on command', async () => {
    const { server } = await startTestBackend({
      features: [
        techdocsAiPostmortemPlugin(),
        mockSlackServiceFactory(),
        mockUrlReaderFactory,
        mockServices.database.factory(), // Backs the LangGraph checkpointer
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    // Step A: Post a simulated PagerDuty resolution event via supertest.
    // Step B: Assert the graph completes the gather/write nodes and saves a state checkpoint.
    // Step C: Verify the PostgreSQL table contains a run record in a 'PENDING_APPROVAL' state.
    // Step D: Put an approval update to the resume route; assert the graph completes the commit phase.
  });
});
```

### 2. Standardized Checkpoint and SSE Verification

Because this plugin matches the core LangGraph design pattern used by your platform, you can reuse your top-level `test-fixtures` utilities to verify that Server-Sent Events (SSE) emit accurate step logs (`node:log-gatherer -> start`, `node:log-gatherer -> end`) as the state graph transitions through the workflow.

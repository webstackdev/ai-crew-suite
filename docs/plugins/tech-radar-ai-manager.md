---
layout: default
title: Automated Tech Radar Management
parent: Other
plugin_name: tech-radar-ai-manager
subcategory: Strategic Planning
---

# Automated Tech Radar Management

{: .no_toc }

<span class="label label-blue">{{ page.subcategory }}</span>

---

## Overview

This plugin continuously scans internal repositories and software lifecycle telemetry to automatically recommend status promotions or deprecations on your company's Technology Radar.

- **The Task:** Maintaining the Backstage Tech Radar.
- **The Logic:** A **LangGraph** agent monitors all new PRs and `package.json` changes across the organization.
  - **Deprecation & Security Drift Tracking**: If a library is moved to the "Hold" or "End of Life" quadrant on your radar, the agent can scan all repositories, flag components still utilizing it, and automatically open tracking issues for the respective software owners.
  - **Library Adoption**: If it sees a sudden spike in a new library (e.g., everyone is suddenly using _Vite_ instead of _Webpack_), it automatically drafts a proposal to move that technology from "Assess" to "Adopt" on the company Tech Radar.
  - **Duplicate Capability Alerts**: If a team introduces an entirely new state-management tool when three others are already widely adopted, the agent can flag the PR and notify the authors (_"We noticed you are introducing X; did you consider using Y, which is currently in our 'Adopt' quadrant?"_).
  - **Quarterly Review Summarizer**: The agent can compile a historical ledger of adoption velocity over the past 90 days, drafting an executive summary for your Architecture Review Board to streamline manual radar updates.
- **Framework:** **LangGraph** for the continuous state-tracking and long-running analysis.

## Dependencies & Mock Targets

### 1. Core Backstage Services (`coreServices`)

- **`coreServices.urlReader`**: Crucial for reading your centralized Tech Radar source file (typically a `radar-data.json` or `radar.yaml`) and parsing `package.json` manifests across hundreds of repositories.
- **`coreServices.database`**: Manages the persistent session states and tracks cumulative package installation metrics over time to calculate adoption velocity.
- **`coreServices.scheduler`**: Powers long-running, periodic evaluation ticks (e.g., executing a deep repository sweep every Sunday night).

### 2. Sibling Plugins & Data Sources

- **`TechRadar` Plugin Interface**: The target interface. The agent interacts with this backend surface to submit proposed changes to quadrants (e.g., Languages, Frameworks) and rings (e.g., Assess, Trial, Adopt, Hold).
- **`CatalogBackend` / `CatalogService`**: Used to identify all active repositories in the organization so the agent knows which codebases to scan for `package.json` or `go.mod` files.
- **`GithubBackend` / `GithubService`**: Used to hook into a broad organization commit stream or search code history across the entire GitHub workspace.

## Testing Strategy

Because this **LangGraph** flow relies on tracking longitudinal data points (changes over time across multiple codebases), your unit and integration tests must simulate historical trends without running heavy external search indices.

### 1. Simulating Multi-Repository Package Trends

You need to verify that if a threshold is crossed (e.g., Vite appearing in >30% of scanned `package.json` files), the _Trend Analysis_ node shifts its internal state and transitions to the _Draft Proposal_ node.

Inject these dependencies into your Backstage backend test harness using custom service factories:

```typescript
import {
  createServiceFactory,
  createServiceRef,
} from '@backstage/backend-plugin-api';
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import { techRadarAiManagerPlugin } from '../plugin';

// 1. Mock the GitHub service to simulate package definitions across multiple components
const mockGithubCodebaseFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'github.service' }),
  deps: {},
  async factory() {
    return {
      // Simulate finding Vite in multiple codebases during a global repository sweep
      searchManifests: async (query: string) => [
        {
          repo: 'repo-alpha',
          file: 'package.json',
          content: '{"dependencies": {"vite": "^5.0.0"}}',
        },
        {
          repo: 'repo-beta',
          file: 'package.json',
          content: '{"dependencies": {"vite": "^5.0.0"}}',
        },
        {
          repo: 'repo-gamma',
          file: 'package.json',
          content: '{"dependencies": {"webpack": "^5.0.0"}}',
        },
      ],
    };
  },
});

// 2. Mock the central Tech Radar source to provide the current state
const mockUrlReaderRadarFactory = mockServices.urlReader.factory({
  extraReaders: [
    {
      canRead: url => url.pathname.includes('radar-data.json'),
      read: async () =>
        Buffer.from(
          JSON.stringify({
            entries: [
              { id: 'vite', title: 'Vite', ring: 'assess', quadrant: 'tools' },
              {
                id: 'webpack',
                title: 'Webpack',
                ring: 'adopt',
                quadrant: 'tools',
              },
            ],
          }),
        ),
      readUrl: async () => ({ buffer: async () => Buffer.from('') }),
    },
  ],
});

// 3. Execute the LangGraph workflow validation
describe('Automated Tech Radar LangGraph Execution', () => {
  it('should detect adoption spikes, cross-reference current radar rings, and stage a ring promotion', async () => {
    const { server } = await startTestBackend({
      features: [
        techRadarAiManagerPlugin(),
        mockGithubCodebaseFactory(),
        mockUrlReaderRadarFactory,
        mockServices.catalog.factory({
          // Provide target entities for the scan boundary
          entities: [
            {
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              metadata: {
                name: 'service-a',
                annotations: { '://github.com': 'org/repo-alpha' },
              },
            },
            {
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              metadata: {
                name: 'service-b',
                annotations: { '://github.com': 'org/repo-beta' },
              },
            },
          ],
        }),
        mockServices.database.factory(), // Preserves historical trend state metrics
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    // Step A: Invoke the analysis loop via a scheduled task trigger in the test block.
    // Step B: Assert that the LangGraph evaluates the high concentration of Vite configurations.
    // Step C: Verify that the graph outputs a proposal to shift Vite from 'Assess' to 'Trial' or 'Adopt'.
    // Step D: Query the database to ensure a human review task is generated for the Architecture board.
  });
});
```

### 2. Hardening Long-Running State Transitions

Since this agent monitors asynchronous trends over long horizons, use your testing suite to confirm that when a repository sweep completes, the running state metrics are safely preserved within your local SQLite/PostgreSQL `mockServices.database()` wrapper. Verify that if the execution is interrupted mid-way through scanning 100 repositories, the LangGraph `PostgresSaver` checkpoint can instantly restore the exact scan pointer and resume without losing previously aggregated package counters.

---
plugin_name: alert-ai-tuner
category: Incident Response
subcategory: Operations
---

# Alert Fatigue Tuner

- **The Task:** Reducing Alert Fatigue.
- **The Logic:** An agent monitors your PagerDuty or Opsgenie alerts. If an alert is triggered but consistently closed without any code changes or manual action (false positives), the agent opens a PR to your Terraform repository to tweak the threshold of that specific Prometheus alert.
- **Framework:** **LangGraph** to handle the "Observe -> Threshold Analysis -> PR" flow.

## Dependencies & Mock Targets

This assistant operates a **highly sensitive write-back workflow**. It reads alert resolution histories, cross-references infra changes, calculates statistical thresholds, and modifies Infrastructure-as-Code (IaC) files directly.

### 1. Core Backstage Services (`coreServices`)

- **`coreServices.urlReader`**: Used by the agent to read your Terraform or OpenTofu repository files (e.g., `alerts.tf`, `prometheus-rules.yaml`) to find where the threshold values are defined.
- **`coreServices.database`**: Vital for storing execution runs, tracking token costs, and holding the **critical human-in-the-loop approval gates** before any Terraform pull request is opened.
- **`coreServices.scheduler`**: Runs the evaluation graph periodically (e.g., every Monday morning) to scan the past week's alert history for tuning opportunities.

### 2. Sibling Plugins & Data Sources

- **PagerDuty / Opsgenie Node Plugins**: Provides the history of triggered alerts, including timestamps for when they opened and closed, and whether they were resolved automatically or manually.
- **`GithubBackend` / `GithubService` (or GitLab equivalents)**: Used by the final node to create a branch, update the Terraform source files, and open a Pull Request against the infrastructure repository.

## Testing Strategy

Because this **LangGraph** workflow modifies real infrastructure files, your testing strategy must rigorously validate the self-correction logic and ensure the graph cannot bypass the human approval checkpoint.

### 1. Simulating the Threshold Analysis and Code Modification

You need to verify that if an alert fires 20 times a week but is closed automatically within 2 minutes with no remediation code pushed, the _Threshold Analysis_ node calculates a safe new boundary and the _File Modification_ node applies the exact string replacement in the Terraform file.

Inject these dependencies into your Backstage backend test harness using custom service factories:

```typescript
import {
  createServiceFactory,
  createServiceRef,
} from '@backstage/backend-plugin-api';
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import { alertAiTunerPlugin } from '../plugin';

// 1. Mock PagerDuty history to reflect a classic false-positive alert pattern
const mockPagerDutyAlertHistoryFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'pagerduty.service' }),
  deps: {},
  async factory() {
    return {
      getHistoricalAlerts: async () =>
        Array(15).fill({
          title: 'CPU Utilization exceeds 85%',
          service: 'payment-service',
          status: 'resolved',
          resolved_by: 'auto-resolve', // Key indicator for false positive
          duration_seconds: 90,
        }),
    };
  },
});

// 2. Mock GitHub to provide raw Terraform content and catch the resulting PR
const mockGithubInfraRepoFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'github.service' }),
  deps: {},
  async factory() {
    return {
      getFileContent: async (repo: string, path: string) => `
        resource "prometheus_alert" "cpu_high" {
          name      = "cpu-utilization-high"
          threshold = 85
          duration  = "2m"
        }
      `,
      createPullRequest: async (
        repo: string,
        branch: string,
        changes: string,
      ) => {
        // Assert that the agent accurately calculated a higher threshold or longer duration
        if (
          changes.includes('threshold = 90') ||
          changes.includes('duration  = "5m"')
        ) {
          return { status: 'SUCCESS', prUrl: 'https://github.com' };
        }
        throw new Error(
          'Agent output did not correctly modify the threshold string.',
        );
      },
    };
  },
});

// 3. Execute the LangGraph workflow validation
describe('Alert Fatigue Tuner LangGraph Execution', () => {
  it('should detect auto-resolved loops, calculate new rules, and wait for infrastructure team approval', async () => {
    const { server } = await startTestBackend({
      features: [
        alertAiTunerPlugin(),
        mockPagerDutyAlertHistoryFactory(),
        mockGithubInfraRepoFactory(),
        mockServices.database.factory(), // Backs the LangGraph PostgresSaver checkpoint manager
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    // Step A: Trigger an on-demand optimization check via a mock router client POST request.
    // Step B: Assert that the LangGraph processes the history and halts at the human approval gate.
    // Step C: Inspect the database to verify the staged code delta shows a safe alteration.
    // Step D: Put an approval update to the resume route; assert the graph completes and triggers the `createPullRequest` block.
  });
});
```

### 2. Hardening the Approval State

Since your underlying agentic platform relies on persistent PostgreSQL checkpoints, use the test execution loop to explicitly verify that the graph state cannot accidentally slide past the _Human-in-the-loop_ node if the LLM hallucinatingly tries to skip a tool step. Assert that the run stays locked in `PENDING_APPROVAL` until a verified user session signature overrides the node boundary.

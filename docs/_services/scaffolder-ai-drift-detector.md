---
plugin_name: scaffolder-ai-drift-detector
category: Scaffolder
subcategory: Governance
---

# Architecture Drift Detector

- **The Task**: Detecting, analyzing, and auto-remediating variance between a component's original golden-path Scaffolder blueprint and its live, operational infrastructure state.
- **The Logic**: Rather than performing a simple string comparison, a **Stateful Reconciliation Agent** ingests live topology data using the **Kubernetes and Cloud Provider tool packs** and contrasts it against the original Software Template specs stored in PostgreSQL. When structural anomalies or "shadow IT" resources are identified, the graph initializes an evaluation loop. Instead of just failing a check, the agent calculates the technical and financial delta, compiles a remediation patch, and routes it through a **HITL platform gate** allowing engineers to auto-sync the repo infrastructure files back to the golden path with one click.
- **Framework**: **LangGraph / Stateful Orchestrator** leveraging continuous comparative loops, Kubernetes/cloud infrastructure tool integrations, and transactional HITL patch application.

## Dependencies & Mock Targets

This assistant operates as a **scheduled reconciliation and remediation loop**. It constantly measures live-state reality against scaffolding blueprints to eliminate configuration drift, providing a self-healing patch engine instead of static failure reports.

### 1. Core Backstage Services (`coreServices`)

- **`coreServices.scheduler`**: Coordinates periodic background sweeps across the active catalog fleet (e.g., executing a full workspace drift audit every 24 hours).
- **`coreServices.database`**: Powers the LangGraph `PostgresSaver` checkpointer. It stores historical golden-path blueprints, tracks active drift states, and retains remediation patches awaiting engineering approval.
- **`coreServices.urlReader`**: Used by the agent to inspect the current live repository files (e.g., the component's `main.tf` or `deployment.yaml` in Git) to isolate file-level variances.

### 2. Sibling Plugins & Data Sources

- **`CatalogBackend` / `CatalogService`**: Provides the evaluation targets. The agent reads component annotations to discover connected cloud infrastructure handles or active Kubernetes namespaces.
- **Kubernetes & Cloud Provider Tool Packs**: Polled to extract real-time live topology metadata (e.g., active cluster configurations, container resource limits, or unexpected block storage attachments).
- **`GithubBackend` / `GithubService`**: Target for the final tool nodes to automatically commit the auto-sync remediation pull request once user approval is cleared.

## Testing Strategy

The **LangGraph** workflow maps this out as a transactional comparative loop (_Ingest Live State → Load Scaffolder Blueprint → Delta & Patch Analysis → HITL Approval Gate → Commit Auto-Sync_).

Your integration tests must confirm that when live container limits diverge from their template configuration, the graph correctly isolates the divergence and generates a precise code patch without modifying the live cluster prematurely.

```text
  ┌───────────────────┐      ┌─────────────────────────┐
  │ Ingest Live State │ ───> │Load Scaffolder Blueprint│
  └───────────────────┘      └────────────┬────────────┘
                                          │
                                          ▼
  ┌───────────────────┐      ┌─────────────────────────┐
  │Commit Auto-Sync PR│ <─── │ Delta & Patch Analysis  │
  └───────────────────┘      └────────────┬────────────┘
         ▲                                │
         │ (Approved)                     ▼
         └────────────────── ┌─────────────────────────┐
                             │   [HITL Approval Gate]  │ (Graph freezes/saves state)
                             └─────────────────────────┘
```

### 1. Simulating Drift Isolation and Automated Patch Building

You need to verify that when the _Ingest_ node identifies an unapproved configuration override (e.g., an unauthorized replica count increase or a resource memory scale down), the agent correctly maps it against the database's original template record and builds a compliant Git fix.

Inject these components into your Backstage backend test harness using custom service factories:

```typescript
import {
  createServiceFactory,
  createServiceRef,
} from '@backstage/backend-plugin-api';
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import { scaffolderAiDriftDetectorPlugin } from '../plugin';

// 1. Mock the Kubernetes toolpack to reflect an overridden active topology state
const mockK8sLiveStateFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'kubernetes.service' }),
  deps: {},
  async factory() {
    return {
      getLiveDeploymentMetadata: async (namespace: string, name: string) => ({
        // Live state shows 6 replicas, which deviates from standard golden path templates
        replicas: 6,
        resources: { limits: { memory: '512Mi' } },
      }),
    };
  },
});

// 2. Mock GitHub to capture the resulting remediation code injection block
const mockGithubRemediationFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'github.service' }),
  deps: {},
  async factory() {
    return {
      createSyncPullRequest: async (repo: string, patchContent: string) => {
        // Assert that the patch accurately attempts to sync the code back to 2 replicas
        if (patchContent.includes('replicas: 2')) {
          return { status: 'SUCCESS', prUrl: 'https://github.com' };
        }
        throw new Error(`Invalid patch compiled by agent: ${patchContent}`);
      },
    };
  },
});

// 3. Execute the LangGraph drift reconciliation validation
describe('Architecture Drift Detector LangGraph Validation', () => {
  it('should isolate topology variance, build a valid remediation patch, and hold at the HITL gate', async () => {
    const { server } = await startTestBackend({
      features: [
        scaffolderAiDriftDetectorPlugin(),
        mockK8sLiveStateFactory(),
        mockGithubRemediationFactory(),
        mockServices.database.factory(), // Preserves original blueprints and active checkpointer states
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    // Seed your local test database with the expected golden-path blueprint metadata
    const db = await mockServices.database.factory().getClient();
    await db('scaffolder_blueprints').insert({
      component_id: 'payment-processor',
      template_id: 'standard-node-service',
      expected_topology: JSON.stringify({
        replicas: 2,
        resources: { limits: { memory: '512Mi' } },
      }),
    });

    // Step A: Trigger the drift detection loop manually via a simulated scheduler hook.
    // Step B: Assert that the LangGraph evaluates the live replica variance (6 vs 2).
    // Step C: Verify that the graph halts and stores a 'DRIFT_DETECTED' status in the database checkpoint.
    // Step D: Put a confirmation execution payload to the resume endpoint; verify the graph wakes up and fires the `createSyncPullRequest` command.
  });
});
```

### 2. Validating State Persistence of Unresolved Drift

Because software components can sit in a drifted state for days while developers review recommendations, ensure your LangGraph state-saving layer is perfectly stable over long durations. Verify that the execution runtime securely stores the transient state layout within your `mockServices.database()` wrapper. Consecutive background scans should look up this record and update the metrics without spawning duplicate evaluation threads or clearing the active tracking ID from the Backstage UI.

## Strategic Evaluation

**Is this better done by SaaS tools, and will developers use it?**

_SaaS Product Overlap_

**Yes, there is heavy overlap with specialized tools, but with a critical gap.**
Infrastructure drift detection is natively handled by tools like **Terraform Cloud, Atlantis, or AWS Config**, while Kubernetes configuration drift is dominated by GitOps controllers like **ArgoCD**.

However, SaaS tools suffer from a **context vacuum**. ArgoCD can tell an operator that a Kubernetes deployment has changed, but it has _no idea why_. It does not know who owns the service, what team handles it, what business unit it belongs to, or what the original "golden path" blueprint looked like.

_The Backstage Win_

Your plugin wins because **Backstage is the single source of context.** By anchoring drift detection inside your monorepo platform, your agent can uniquely cross-reference live infrastructure drift with the **Backstage Org Graph and Catalog Metadata**:

- When a SaaS tool alerts, it goes to a generic platform engineering Slack channel.
- When _your_ agent detects drift, it identifies the exact `spec.owner` from the Backstage catalog, looks up the team's active channel via the **Slack tool pack**, and sends a targeted, context-rich notification directly to the developers responsible.

_Will Users Actually Use It?_

- **Platform Engineers / SREs**: **Absolutely.** This solves their biggest headache: developers spinning up non-compliant, unmonitored resources after a project is scaffolded. A centralized Backstage dashboard showing compliance drift across all microservices is an enterprise platform team's holy grail.
- **Product Developers**: They will not interact with it actively. Instead, they will consume its output passively when the agent opens an automated, easy-to-merge Pull Request fixing a misconfigured file in their repository to bring them back into compliance.

###

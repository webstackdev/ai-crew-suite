---
plugin_name: scaffolder-ai-shadow-detective
category: Scaffolder
subcategory: Governance
---

# Cloud Resource Detective

- **The Task**: Identifying unregistered cloud infrastructure and autonomously migrating "shadow IT" resources into governed Backstage Software Catalog components.
- **The Logic**: A stateful **Multi-Agent Reconciliation Loop** executes scheduled deep infrastructure audits. A **Scout Agent Node** utilizes cloud provider tool packs to inventory live cloud resources (e.g., S3 buckets, RDS instances, EC2 clusters). A downstream **Archivist Agent Node** cross-references these assets against active Backstage Catalog entity bindings. If an orphaned resource is detected, the agent analyzes historical resource tags, billing codes, and creation logs to deduce ownership. Finally, a **Communicator Agent Node** pings the targeted team via the _Slack Tool Pack_, delivering a direct, pre-populated link to a **Backstage Scaffolder template** to safely register or decommission the asset.
- **Framework**: **LangGraph / Stateful Orchestrator** utilizing multi-agent role collaboration, cloud provider/Slack tool packs, and asynchronous catalog reconciliation loops.

## Dependencies & Mock Targets

This assistant operates a **scheduled reconciliation and outreach loop**. It bridges the gap between active cloud infrastructure providers and the Backstage entity ecosystem, enforcing platform engineering governance across "shadow" workloads.

### 1. Core Backstage Services (`coreServices`)

- **`coreServices.scheduler`**: Coordinates the recurring deep infrastructure audit intervals (e.g., executing a full cloud scan every Sunday at 02:00).
- **`coreServices.database`**: Backs the persistent session checkpoints, deduplication ledger (to avoid multi-pinging Slack for the same resource), and token/cost accounting.
- **`coreServices.discovery`**: Resolves the internal URLs of sibling backend plugins (like the Scaffolder) to dynamically assemble registration target pathways.

### 2. Sibling Plugins & Data Sources

- **`CatalogBackend` / `CatalogService`**: Cross-referenced by the _Archivist_ node to verify if discovered cloud resource IDs are already declared in the software catalog via infrastructure annotations (e.g., `://amazon.com`).
- **`ScaffolderBackend` / `ScaffolderService`**: Targeted by the _Communicator_ node to generate pre-populated template execution URLs that allow engineering teams to easily register or claim the orphaned asset.
- **Slack Tool Pack**: Utilized to deliver interactive triage notifications directly to team workspace channels.
- **Cloud Provider Tool Packs (AWS, GCP, Azure Services)**: Polled by the _Scout_ node to pull raw cluster, database, and object storage descriptors alongside runtime billing metrics.

## Testing Strategy

The **LangGraph** flow maps this out as a sequential reconciliation network (_Inventory Cloud → Cross-Reference Catalog → Infer Ownership → Dispatch Slack Action_).

Your integration testing must focus on verifying that the graph can process a mix of registered and unregistered assets, correctly tracking the state of orphaned resources without spamming channels on consecutive runs.

```text
  │  Inventory Cloud │ ───> │ Cross-Reference Catalog │ ───> │     Infer Ownership     │
   Pulls live cloud         Filters out resources already                │
   resource data structures declared in Backstage entries               ▼
                                                               │  Dispatch Slack Action  │
```

### 1. Simulating Cloud Asset Ingestion and Deduplication

You need to verify that when the _Inventory_ node catches an orphaned infrastructure ARN, the _Infer_ node correctly falls back to parsing raw creator tags, and the _Communicator_ node surfaces an accurate Scaffolder deep-link.

Inject these dependencies into your Backstage backend test harness using custom service factories:

```typescript
import {
  createServiceFactory,
  createServiceRef,
} from '@backstage/backend-plugin-api';
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import { cloudResourceDetectivePlugin } from '../plugin';

// 1. Mock the Cloud Provider toolpack to return a mix of infrastructure assets
const mockAwsInfrastructureFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'aws.service' }),
  deps: {},
  async factory() {
    return {
      describeAllRdsInstances: async () => [
        // Resource A: Fully governed and active
        {
          rdsId: 'db-registered-01',
          arn: 'arn:aws:rds:us-east-1:1234:db:db-registered-01',
          tags: { owner: 'team-checkout' },
        },
        // Resource B: Shadow IT / Orphaned resource
        {
          rdsId: 'db-shadow-99',
          arn: 'arn:aws:rds:us-east-1:1234:db:db-shadow-99',
          tags: { 'created-by': 'dev-alpha@company.com' },
        },
      ],
    };
  },
});

// 2. Mock the Slack toolpack to capture notification telemetry
const mockSlackNotificationFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'slack.service' }),
  deps: {},
  async factory() {
    return {
      postMessageToTeam: async (teamId: string, text: string) => {
        // Assert that the alert text includes the target Scaffolder registration route
        if (
          teamId === 'team-checkout' &&
          text.includes('/create/templates/register-existing-resource')
        ) {
          return { messageId: 'slack-msg-abc-123' };
        }
        throw new Error(`Invalid alert routed to team ${teamId}: ${text}`);
      },
    };
  },
});

// 3. Execute the LangGraph workflow validation
describe('Cloud Resource Detective LangGraph Execution', () => {
  it('should filter registered resources, deduce ownership for shadow assets, and alert via Slack', async () => {
    const { server } = await startTestBackend({
      features: [
        cloudResourceDetectivePlugin(),
        mockAwsInfrastructureFactory(),
        mockSlackNotificationFactory(),
        mockServices.catalog.factory({
          entities: [
            {
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Resource',
              metadata: {
                name: 'checkout-production-db',
                annotations: {
                  '://amazon.com':
                    'arn:aws:rds:us-east-1:1234:db:db-registered-01',
                },
              },
              spec: { type: 'database', owner: 'team-checkout' },
            },
            {
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'User',
              metadata: { name: 'dev-alpha' },
              spec: {
                profile: { email: 'dev-alpha@company.com' },
                memberOf: ['team-checkout'],
              }, // Maps dev-alpha back to team-checkout
            },
          ],
        }),
        mockServices.database.factory(), // Prevents duplicate Slack pings across cron intervals
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    // Step A: Trigger the reconciliation loop manually using the test scheduler abstraction.
    // Step B: Assert that the LangGraph ignores 'db-registered-01' because its ARN matches a catalog record.
    // Step C: Verify that the graph successfully links 'db-shadow-99' to 'team-checkout' via the creator email resolution path.
    // Step D: Confirm that a consecutive execution cycle records a cache hit in the database and bypasses duplicate Slack dispatches.
  });
});
```

### 2. Hardening In-Flight State Persistence

Because massive global cloud provider scans often encounter network pauses or strict rate limits, verify that your graph state is highly resilient. Use your localized `mockServices.database()` harness to ensure that if a timeout occurs while reading from your cloud toolpack mid-run, your `PostgresSaver` checkpoint stores the exact processing cursor. When the graph resumes, it should pick up immediately at the catalog evaluation node without re-initiating the costly cloud asset collection sequence.

## Strategic Evaluation

**Is this better done by SaaS tools, and will developers use it?**

_SaaS Product Overlap_

**Yes, this overlaps with cloud security and compliance products, but they are notoriously ineffective at remediation.**
Cloud security posture management (CSPM) and SaaS cloud governance tools (like Wiz, Palo Alto Prisma, or cloud-native AWS Config/Azure Advisor dashboards) are fantastic at scanning your infrastructure. They will easily output a PDF report listing 4,000 untagged, orphaned S3 buckets.

However, they completely fail at **human routing and resolution**. A traditional SaaS compliance platform doesn't understand your engineering org structure, who currently sits on which product team, or how those services tie into your developer portal's catalog lifecycle. They blast alerts into a generic infrastructure security channel where they are permanently ignored.

_The Backstage Win_

Your plugin turns a static "compliance alarm" into an **active operational workflow** by sitting directly on top of the organizational graph and the Scaffolder.

- **Contextual Deduction**: Because your agent platform is embedded in the Backstage monorepo, it has read access to your full organization layout, past code commit structures, and developer telemetry. It can trace an untagged AWS bucket's creation history, match it to a specific developer's email, and locate their current active engineering squad in the Backstage Org Graph.
- **Frictionless Remediation Paths**: Standard SaaS tools tell an engineer, _"Go fix this."_ Your plugin builds the bridge: it generates an absolute path to a specific Backstage Scaffolder template, pre-filling all the complex metadata arguments automatically. The developer just has to click **"Approve / Register Component"** inside their portal interface.

_Will Users Actually Use It?_

- **FinOps and Platform Security Teams**: **Yes, this is an incredibly high-value feature.** It actively downsizes wasted cloud spend, eliminates orphaned infrastructure vulnerability vectors, and forces catalog compliance organically.
- **Product Engineers**: They will tolerate and use it because it lowers the cognitive barrier to compliance. Instead of forcing them to manually read platform engineering wikis on how to fill out a YAML template for a stray resource, an AI agent surfaces an automated, one-click resolution screen inside the portal they already use daily.

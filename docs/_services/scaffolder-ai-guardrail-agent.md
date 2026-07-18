---
plugin_name: scaffolder-ai-guardrail-agent
category: Scaffolder
subcategory: Golden Path Provisioning
---

# Policy Guardrail Agent

- **The Task**: Intercepting and auditing inbound Backstage Scaffolder requests to enforce corporate architecture, security, and financial policies prior to infrastructure execution.
- **The Logic**: Rather than relying on rigid, hardcoded schema validation, an inbound Scaffolder request triggers a **Policy Guardrail Agent**. The agent reads the request parameters and cross-references them against an organization's central policy directives. If a request violates standard operating boundaries (e.g., attempting to provision an unapproved database cluster size or selecting a non-compliant cloud region), the graph branches into a **Human-in-the-Loop (HITL) Clarification State**. This pauses execution, retains the session checkpoint in PostgreSQL, and alerts the platform security or finance team to review, override, or provide feedback directly within the Backstage UI.
- **Framework**: **LangGraph / Stateful Orchestrator** using cyclic branching logic, centralized state persistence, and native HITL approval and escalation gates.
- **The Core Platform Win**: This is an exceptional use of your specialized runtime. This plugin single-handedly solves one of the biggest platform engineering problems: balancing developer velocity with enterprise governance. Traditional OPA (Open Policy Agent) gates fail here because they are binary (pass/fail). Your agent platform introduces a **negotiation layer** where the agent can say, _"You cannot spin up this heavy instance type for a testing environment, but if you click approve, I will automatically downscale it for you and proceed."_
- **Incorporate Cost Accounting Tools**: Because you built token and cost accounting controls into your core monorepo engine, pass those same metrics to the compliance judge. The agent can evaluate the financial impact of a Scaffolder request (e.g., estimating cloud spend based on the chosen instance type parameter) and conditionally route requests over a specific budget threshold through an explicit engineering leadership approval loop.

## Dependencies & Mock Targets

This assistant operates a **gatekeeper reconciliation and negotiation loop**. It shifts enterprise governance from a binary block (pass/fail) into an interactive, self-healing mediation layer that dynamically adjusts parameters to enforce security and financial rules.

### 1. Core Backstage Services (`coreServices`)

- **`coreServices.database`**: Powers the LangGraph `PostgresSaver` checkpointer. It locks the running state when a policy threshold is breached, preserving session contexts and tracking parameters during the negotiation lifecycle.
- **`coreServices.httpRouter`**: Handles Server-Sent Events (SSE) streaming to show developers exactly which compliance boundaries were triggered and what modifications the agent proposes.
- **`coreServices.rootConfig`**: Houses static financial budget thresholds and acceptable regional cloud parameters.

### 2. Sibling Plugins & Data Sources

- **`ScaffolderBackend` / `ScaffolderService`**: The immediate execution container. This agent acts as a pre-flight interception module (`@internal/scaffolder-backend-module-policy-guardrail`) that inspects inbound payload parameters _before_ any step tasks fire.
- **FinOps / Cost Accounting Database**: Queried by the agent to evaluate the projected monthly cloud burn rate based on selected compute and storage parameters.
- **Catalog / OPA Policies**: Provides active enterprise compliance blueprints (such as mandatory token rotation rules or restricted VPC networks).

## Testing Strategy

The **LangGraph** workflow maps this out as a cyclic evaluation network (_Intercept Parameters → Evaluate Policies → Conditional Branching [Budget/Security Violation?] → Negotiation Loop / HITL Gate → Mutate & Execute_).

Your integration testing must focus on verifying that the agent can autonomously downscale non-compliant values, pause for human overrides when budgets are breached, and safely pass through parameters that satisfy all policies.

```text
               ┌───────────────────────────┐
               │ Inbound Scaffolder Input  │
               └─────────────┬─────────────┘
                             │
                             ▼
               ┌───────────────────────────┐
               │   Policy Analysis Node    │ (Queries FinOps & Security rules)
               └─────────────┬─────────────┘
                             │
               ┌─────────────┴─────────────┐
        (Valid)│                           │(Violation / High Budget)
               ▼                           ▼
  ┌────────────────────────┐   ┌───────────────────────────┐
  │ Pass to Scaffolder Run │   │  Negotiation & HITL Gate  │ <──┐
  └────────────────────────┘   └───────────┬───────────────┘    │
                                           │                    │
                                (Reject)   ▼   (Auto-Downscale) ┘
                                      ───> 🛑 (Halt)
```

### 1. Simulating Policy Mediation and Financial Escalation

You need to verify that when an inbound request requests a massive cluster size that exceeds a cost profile, the graph accurately halts at the database checkpoint, flags the financial anomaly, and offers an automated downscaling compromise.

Inject these components into the `startTestBackend` matrix using standard service factories:

```typescript
import {
  createServiceFactory,
  createServiceRef,
} from '@backstage/backend-plugin-api';
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import { scaffolderAiGuardrailAgentPlugin } from '../plugin';

// 1. Mock a FinOps cost calculation service inside your test workspace
const mockFinOpsCostFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'finops.service' }),
  deps: {},
  async factory() {
    return {
      estimateMonthlySpend: async (parameters: any) => {
        if (parameters.instanceType === 'db.m5.16xlarge') {
          return { projectedCostUSD: 4500, tier: 'HIGH_RISK' };
        }
        return { projectedCostUSD: 120, tier: 'LOW_RISK' };
      },
    };
  },
});

// 2. Execute the cyclic compliance and negotiation LangGraph validation
describe('Policy Guardrail Agent LangGraph Logic', () => {
  it('should flag budget violations, halt at the checkpointer, and offer parameter mutation packages', async () => {
    const { server } = await startTestBackend({
      features: [
        scaffolderAiGuardrailAgentPlugin(),
        mockFinOpsCostFactory(),
        mockServices.database.factory(), // Backs the PostgresSaver checkpoint layer
        mockServices.rootConfig.factory({
          data: {
            governance: { budgetAlertLimit: 1000 }, // Sets a 1000 USD limit to trigger the loop
          },
        }),
      ],
    });

    // Step A: Post a heavy parameter request payload via supertest simulating an expensive cluster provision request.
    // Step B: Assert that the LangGraph runtime catches the budget overshoot (>1000 USD) via the FinOps tool node.
    // Step C: Verify that the graph pauses and registers a 'PENDING_REVIEWS' status inside the database checkpoint.
    // Step D: Extract the transient graph state from the table; confirm it contains an automated compromise option ("Change instanceType to db.m5.large for $120/mo").
    // Step E: PUT a confirmation payload accepting the downscaled compromise; verify the graph mutates the payload and passes it smoothly to the execution node.
  });
});
```

### 2. Testing the Idempotency Threshold Gate

Because developers may continuously re-submit altered forms while trying to pass governance checks, test the **idempotency tracking** layer. Ensure that your database tracks a unique fingerprint hash of the request signature (User ID + Template ID + Exact Parameters). Include a test block that fires identical non-compliant parameters in rapid succession. Assert that the LangGraph checkpointer instantly returns the existing unresolved negotiation session artifact instead of spinning up duplicate evaluation runs, conserving your LLM token budget.

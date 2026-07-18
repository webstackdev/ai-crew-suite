---
plugin_name: scaffolder-ai-infra
category: Scaffolder
subcategory: Golden Path Provisioning
---

# IaC Generator

- **The Task**: Generating tailored, security-hardened infrastructure-as-code files directly during software provisioning runs.
- **The Logic**: Rather than acting as a loose, standalone code generator, this tool executes as an integrated **Scaffolder Action step**. When a software template is triggered, a stateful LangGraph multi-agent network split by technology roles (**Terraform Expert node** vs. **CloudFormation Expert node**) reads the specific capacity variables, pulls base corporate modules via the `urlReader`, generates structural configurations, runs pre-flight syntax checks, and returns compliant code blocks to the active workspace.
- **Framework**: **LangGraph** using a specialized role-routing graph structure and shared infrastructure state variables.

## Dependencies & Mock Targets

### 1. Core Backstage Services (`coreServices`)

- **`coreServices.urlReader`**: Critical for fetching your organization's approved, hardened upstream cloud blueprints (e.g., standard enterprise base modules from a private Terraform registry or centralized Git repository).
- **`coreServices.database`**: Manages operational checkpoints, audits execution run tokens, and captures precise tracking logs for human-in-the-loop review overrides.
- **`coreServices.rootLogger`**: Tracks internal code validation outputs and records linting or parsing anomalies during the formatting phase.

### 2. Sibling Plugins & Data Sources

- **`ScaffolderBackend` / `ScaffolderService`**: The immediate runtime environment. This plugin is packaged as a **custom Scaffolder action** (`@internal/scaffolder-backend-module-ai-infra`). It consumes the parameters gathered by the frontend form and updates the workspace file tree in real-time.
- **Catalog & Policy Registries**: Evaluated by the role nodes to verify that variable metrics (such as allowing public access blocks or provisioning non-standard storage sizes) do not violate enterprise platform engineering guardrails.

Here are the concrete examples of what these data sources and dependencies look like in a Backstage ecosystem:

1. Catalog Dependencies (Context & Naming Registry)

Before generating code, the agent queries the **Backstage Software Catalog** to extract entity definitions and global resource limits.

- **`Resource` & `System` Entities**: The agent inspects existing Catalog resources to ensure it doesn't create duplicate cloud setups. For example, if it needs to provision a database for a service, it checks the catalog to ensure an active `Resource` with that identifier doesn't already exist.
- **Organizational Ownership (`Group` Entities)**: The agent pulls ownership metadata from the catalog to inject precise tag keys into the `main.tf` file. This ensures every cloud resource is automatically tagged with its valid Backstage team owner (e.g., `tags = { Owner = "team-checkout" }`).
- Policy Registries (Compliance Guardrails)

Instead of hardcoding compliance logic inside your prompt templates, your LangGraph validation nodes query external governance engines or static schema definition objects.

- **Open Policy Agent (OPA) / Rego Registry**: Your company might maintain an OPA server to enforce infrastructure policies. The LangGraph validation node passes the generated code strings to OPA to run automated compliance checks before writing to the workspace.
  - _Example policy_: "Databases cannot have public IP addresses exposed to the internet."
  - _Example check_: If the agent generates an `aws_db_instance` with `publicly_accessible = true`, the OPA policy registry rejects it, and the graph loops backward to force a self-correction.
- **Backstage Permission Policies**: The registry validates whether the user triggering the Scaffolder template actually has the permission to provision the requested resource tier (e.g., restricting large production-grade cluster sizes to authorized team leads).
- **Static Architecture Policies**: A centralized file registry defining valid configuration criteria—such as lists of allowed AWS regions, standard instance families, and mandatory encryption algorithms.

## Testing Strategy

By maintaining your unified **LangGraph** architecture, you can test this multi-role file generation step directly inside an isolated Scaffolder action mock harness without spawning external container blocks.

```text
               ┌───────────────────────────┐
               │ Scaffolder Step Trigger   │ (Pisses runtime parameters)
               └─────────────┬─────────────┘
                             │
                             ▼
               ┌───────────────────────────┐
               │    Role Router Node       │ (Inspects target cloud provider)
               └──────┬─────────────┬──────┘
                      │             │
        (Terraform)  ▼             ▼  (CloudFormation)
         ┌─────────────────┐   ┌─────────────────┐
         │ Terraform Node  │   │ CloudForm. Node │
         └────────┬────────┘   └────────┬────────┘
                  │                     │
                  └─────────┬───────────┘
                            ▼
               ┌───────────────────────────┐
               │  Lint & Validation Node   │ (Executes local check blocks)
               └─────────────┬─────────────┘
                             │
                             ▼
               ┌───────────────────────────┐
               │  Update Local Workspace   │ (Writes code back to Scaffolder)
               └───────────────────────────┘
```

### 1. Verifying Specialized Role Routing and Generation

You must verify that the graph accurately routes requests to the correct expert node based on the cloud infrastructure choice, applies organizational policies, and catches syntax mistakes during its validation sequence.

Inject these workspace components using standard test factories:

```typescript
import {
  createServiceFactory,
  createServiceRef,
} from '@backstage/backend-plugin-api';
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import { createMockActionContext } from '@backstage/plugin-scaffolder-node-test-utils';
import { createGenerateInfraAction } from '../actions/generateInfra';

// 1. Mock UrlReader to return your corporate base infrastructure blueprint
const mockUrlReaderBlueprintFactory = mockServices.urlReader.factory({
  extraReaders: [
    {
      canRead: url =>
        url.host === 'github.com' && url.pathname.includes('terraform-modules'),
      read: async () => Buffer.from('variable "capacity" { type = number }'),
      readUrl: async () => ({ buffer: async () => Buffer.from('') }),
    },
  ],
});

// 2. Execute the LangGraph action test step
describe('scaffolder-ai-infra LangGraph Action Step', () => {
  it('should route to the Terraform node, consume parameters, and output secure file patterns', async () => {
    // Instantiate your custom Scaffolder action
    const generateInfraAction = createGenerateInfraAction();

    // Set up a mock Scaffolder workspace context containing execution input arrays
    const actionContext = createMockActionContext({
      input: {
        provider: 'terraform',
        serviceName: 'order-processor',
        capacityCpu: 4,
      },
      workspacePath: '/tmp/scaffolder-scratchpad',
    });

    // Execute your LangGraph step wrapper directly
    await generateInfraAction.handler(actionContext);

    // Step A: Assert the LangGraph router directed the state to the Terraform Expert node.
    // Step B: Verify that the graph queried your corporate base module configuration strings.
    // Step C: Confirm that the final state successfully written a valid 'main.tf' to the scratchpad path.
    // Step D: Validate that your platform's token accounting recorded the operational costs.
  });
});
```

### 2. Testing Self-Correction on Linting Anomalies

Because LLMs can occasionally emit minor syntax errors or format deviations when building infrastructure profiles, configure your **Lint & Validation Node** to execute light semantic validation. Write a test case where the generated infrastructure output lacks a required parameter closure. Assert that the LangGraph self-correcting edge detects the processing anomaly, passes the error block backward to the generating expert node, and fixes the structure before finalizing the workspace update.

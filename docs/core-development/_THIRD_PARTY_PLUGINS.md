# Third Party Plugins

The purpose of this document is to track third-party sibling plugins that AI plugins depend on for data.

## Backstage Core Plugins

- CatalogBackend / CatalogService
- KubernetesBackend / KubernetesService
- ScaffolderBackend / ScaffolderService
- TechRadar Plugin Interface
- TechDocsBackend / TechDocsService

## Cloud Provider Tool Packs

- AWS
- GCP
- Azure Services

## VCS Plugins

- Github
- GitLab
- Bitbucket
- Azure DevOps

## Observability Platforms

- Datadog
- OpenTelemetry
- Jaeger
- New Relic
- Splunk

## Ticket Management

- Jira
- Linear

## On-Call Platforms

- PagerDuty
- Opsgenie Node

## Other

- Scorecards
- Soundcheck
- Slack Plugin Interface
- **FinOps / Cost Accounting Database**: Queried by the agent to evaluate the projected monthly cloud burn rate based on selected compute and storage parameters.

## Catalog / OPA Policies

Provides active enterprise compliance blueprints (such as mandatory token rotation rules or restricted VPC networks).

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

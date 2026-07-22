# Core Plugins Provider Notes

Planned Agentic Workflow Plugins Consuming Core Backstage Sibling Plugins

## `CatalogBackend` / `CatalogService`

The following proposed agentic workflow plugins consume this plugin:

- `catalog-ai-insights`: Provides the structural target data. The agent relies heavily on reading specific entity metadata tags like `backstage.io/kubernetes-id`, `://pagerduty.com`, or `://github.com`.
- `rfc-adr-ai-reviewer`: Provides the graph-validation target data. The "Senior Architect" agent uses this service to verify if the components or dependencies referenced in the RFC actually exist or are marked as deprecated.
- `scaffolder-ai-drift-detector`: Provides the evaluation targets. The agent reads component annotations to discover connected cloud infrastructure handles or active Kubernetes namespaces.
- `scaffolder-ai-intent`: Used as a live lookup target during the self-healing validation node to run pre-flight availability checks (e.g., verifying if a requested service name or component identifier is already claimed in the ecosystem registry).
- `scaffolder-ai-shadow-detective`: Cross-referenced by the _Archivist_ node to verify if discovered cloud resource IDs are already declared in the software catalog via infrastructure annotations (e.g., `://amazon.com`).
- `search-ai-archeology`: Crucial for mapping historical git metadata to modern identity assets. The agent queries the catalog specifically for `User` and `Group` entities (the Org Graph) to translate stale commit authors into current active corporate teams.
- `search-ai-context`: The core source for dependency resolution. The agent explicitly uses this plugin to crawl relationship edges like `dependsOn`, `providesApi`, and `dependencyOf` to build the initial consumer list.
- `tech-debt-ai-scout`: Provides the structural target directory. The agent parses the catalog to locate active software assets and find their respective `://github.com` annotations.
- `tech-radar-ai-manager`: Used to identify all active repositories in the organization so the agent knows which codebases to scan for `package.json` or `go.mod` files.

## `knowledge.retrieve` Tool

- `rfc-adr-ai-reviewer`: Ingests cross-organizational standards, security policies, compliance whitepapers, and existing ADRs to provide context boundaries for the critique.
- `search-ai-archeology`: Extracted inside the graph to run semantic string matches against TechDocs repositories and ADR text logs.
- `search-ai-context`: Wrapped inside the agent's graph to provide semantic retrieval capabilities over documentation, architectural RFCs, and API schemas.

## `ScaffolderBackend` / `ScaffolderService`

- `scaffolder-ai-guardrail-agent`: The immediate execution container. This agent acts as a pre-flight interception module (`@internal/scaffolder-backend-module-policy-guardrail`) that inspects inbound payload parameters _before_ any step tasks fire.
- `scaffolder-ai-infra`: The immediate runtime environment. This plugin is packaged as a custom Scaffolder action (`@internal/scaffolder-backend-module-ai-infra`). It consumes the parameters gathered by the frontend form and updates the workspace file tree in real-time.
- `scaffolder-ai-intent`: The primary operational integration point. The agent scans this plugin to query the array of registered `Template` schemas and programmatically trigger task runs after human validation is secured.
- `scaffolder-ai-prd`: Targeted by the Engineer node to programmatically trigger the creation of service codebases based on the chosen software template.
- `scaffolder-ai-shadow-detective`: Targeted by the _Communicator_ node to generate pre-populated template execution URLs that allow engineering teams to easily register or claim the orphaned asset.

## `TechDocsBackend` / `TechDocsService` / `UrlReader`

- `scaffolder-ai-prd`: Targeted by the Technical Writer node to seed the new component's root documentation repository with foundational markdown structures.

- `techdocs-ai-janitor`

- `techdocs-ai-postmortem`: Coordinates where the component's markdown source files live in the underlying git infrastructure.

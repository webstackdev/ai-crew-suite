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

## `KubernetesBackend` Extension Points / Kubernetes Diagnostics Module

- `kubernetes-ai-responder.md`: Reads pod descriptors, status codes (for example `OOMKilled` and `ImagePullBackOff`), bounded log excerpts, and related events during investigation. An alert webhook or scheduler is the trigger; Kubernetes is the first investigation source.
- `catalog-ai-insights`: Answers _"Why did this service fail its last deployment?"_ from workload snapshots, deployment conditions, pods, and event streams.
- `oncall-ai-handover-assistant`: Summarizes bounded deployment, scaling, and rollout events observed during the shift window.

## Whether we need our own extension points to these

I would not create a blanket family of `plugin-ai-core-backend-*` wrappers for every Backstage service. The third-party adapter pattern solves a real instability and configuration problem: provider selection, credential ownership, response normalization, and incompatible capabilities. Core Backstage services generally do not have those properties.

Your notes identify four distinct cases, and they should not all be treated alike.

| Need                                                             | Recommendation                                                                                                                                        | Why                                                                                                                                                                                               |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logger, config, database, scheduler, auth, discovery, URL reader | Inject Backstage `coreServices` directly                                                                                                              | These are deliberate platform contracts. A wrapper only obscures dependencies and complicates testing.                                                                                            |
| Catalog entity and relation lookup                               | Start with the catalog service directly, but define shared AI-facing query helpers in `plugin-ai-core-node` once workflows share nontrivial semantics | The Catalog API is stable and canonical. The AI-specific concern is not access, but safe entity selection, relation traversal, annotation extraction, pagination, and permission-aware filtering. |
| `knowledge.retrieve`                                             | Keep it as the existing AI Core tool/retrieval contract                                                                                               | This is already an AI-native abstraction. It should aggregate indexed sources rather than proxy a single Backstage service.                                                                       |
| Scaffolder actions and task execution                            | Use Scaffolder extension points and actions directly                                                                                                  | These workflows are native Scaffolder extensions, not generic external-service integrations. A universal “scaffolder adapter” would flatten important action, workspace, and task semantics.      |
| TechDocs source discovery and reads                              | Use `UrlReader` directly for source retrieval; use VCS adapters for writes                                                                            | `UrlReader` is already Backstage’s normalized, integration-aware read abstraction. Writing docs is a repository mutation and belongs behind the VCS tool contract.                                |

## My recommendation

Treat the boundaries as three tiers.

**Tier 1: Direct Backstage platform dependencies**

Use `coreServices` directly in the workflow module’s `registerInit` dependencies:

```typescript
deps: {
  logger: coreServices.logger,
  config: coreServices.rootConfig,
  database: coreServices.database,
  urlReader: coreServices.urlReader,
  auth: coreServices.auth,
  discovery: coreServices.discovery,
  scheduler: coreServices.scheduler,
}
```

No `plugin-ai-core-backend-logger`, `-config`, `-url-reader`, or `-database` package should exist. Those would provide no normalization, no provider substitution value, and no useful isolation.

Your logger example is exactly right: inject it directly and use a child logger scoped to the workflow/run context.

**Tier 2: Native Backstage domain services**

For the catalog, use the Backstage catalog service reference directly from a backend workflow module. Do not introduce a separate adapter merely to rename methods such as `getEntityByRef` or `getEntities`.

However, I do expect repeated AI-specific operations to emerge from the workflows in `_NOTES_INTERNAL_PLUGINS.md`:

- Resolve an entity reference from a service name, repository URL, Kubernetes ID, or external annotation.
- Extract a known annotation family safely.
- Traverse `dependsOn`, `dependencyOf`, `providesApi`, ownership, and group membership edges with limits.
- Search `Component`, `API`, `User`, and `Group` entities with consistent pagination and relation expansion.
- Produce compact, serializable summaries rather than raw catalog entities.

When two or three workflows need the same operation, add a **small shared library API** to `plugin-ai-core-node`, for example:

```typescript
export interface CatalogEntityResolver {
  findByExternalReference(input: {
    kind?: string;
    annotation: string;
    value: string;
  }): Promise<CatalogEntitySummary[]>;

  traverseRelations(input: {
    entityRef: string;
    relationTypes: string[];
    maxDepth: number;
  }): Promise<CatalogRelationGraph>;
}
```

That library should accept the native catalog service as a dependency. It should **not** become a plugin that re-registers or proxies the catalog backend.

The important distinction: create a shared semantic helper when you have repeated AI behavior, not an abstraction merely because the underlying API is internal.

**Tier 3: AI-native capabilities**

`knowledge.retrieve` already belongs here. It is neither a raw Backstage Search wrapper nor a TechDocs wrapper; it is your AI runtime’s retrieval contract, potentially backed by catalog, TechDocs, repositories, and vector stores.

I would model catalog and TechDocs indexing similarly:

- A catalog retrieval source turns entities, annotations, relations, and ownership into indexable documents.
- A TechDocs retrieval source turns published docs or source documents into indexable documents.
- Agent workflows use `knowledge.retrieve` when they need semantic context.
- They use direct catalog services only when they need authoritative, structured, current graph operations or writes.

That avoids teaching every future workflow to independently do hybrid search and relation expansion.

## Specific Calls From Your Notes

**Catalog**

This is the strongest candidate for a future shared AI helper layer, but not yet a backend plugin family. The consumers you listed have substantial overlap around annotations, graph relations, users/groups, and entity identity. I would wait until implementing the first two workflow plugins, then extract the shared operations based on real call sites.

A dedicated `catalog-ai-insights` workflow plugin should consume the native catalog service. It should not itself become the catalog access layer for every other plugin.

**Scaffolder**

Keep these as normal Scaffolder backend modules/actions.

- `scaffolder-ai-guardrail-agent`: native action interception or policy action.
- `scaffolder-ai-infra`: native custom Scaffolder action.
- `scaffolder-ai-prd`: likely a template/action producer and task initiator.

The one possible future common layer is an AI-specific **template selection and launch service**, but only if several workflows need the exact same safe template discovery, parameter validation, dry-run, task launch, and task-observation behavior. That should be a narrow helper around the Scaffolder APIs, not a generic plugin proxy.

**TechDocs and `UrlReader`**

Use `UrlReader` directly to read source documents. It already handles integration credentials and provider-specific URL access consistently, which is exactly what your VCS code should rely on for reads.

For writes, do not invent a TechDocs writer: create/update documentation in Git through the VCS tool/provider. TechDocs then publishes the result through its normal lifecycle.

For `techdocs-ai-janitor` and `techdocs-ai-postmortem`, separate these concerns:

- Find the component and its TechDocs source location: Catalog service.
- Read source documents: `UrlReader` or VCS read tool.
- Search semantic documentation context: `knowledge.retrieve`.
- Edit documentation: VCS write-capable workflow with approval/audit.

## Architectural Rule

Use this test before introducing a new `plugin-ai-core-backend-*` package:

> Does this boundary normalize multiple interchangeable implementations, own provider credentials/configuration, or enforce an AI-specific cross-workflow policy that cannot be expressed as a small helper?

- **Yes:** a plugin/module boundary may be warranted.
- **No:** inject the native Backstage service directly.
- **Maybe:** start in `plugin-ai-core-node` as a tested helper or interface, then promote it only after real duplication appears.

This keeps the adapter system disciplined. Otherwise, you risk recreating the entire Backstage backend behind wrappers that add another API surface without removing meaningful complexity.

## Kubernetes

This should be a **single Backstage-native adapter**, not a third-party provider group and not initially a core-plus-`-provider` family.

Name: `plugin-ai-core-backend-module-kubernetes`

### Why It Now Merits a Module

The three workflows need the same hard parts:

| Workflow                       | Needed Kubernetes view                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `kubernetes-ai-responder`      | Current pod/container state, termination reasons, logs, related events                   |
| `catalog-ai-insights`          | Most recent failed rollout or deployment, pods/events explaining the failure             |
| `oncall-ai-handover-assistant` | Deployment, ReplicaSet, scaling, and configuration-related timeline during a time window |

The common problem is not “call Kubernetes.” It is:

1. Resolve a catalog entity to workload identity and allowed clusters.
2. Select the relevant namespace, workload, deployment revision, ReplicaSets, pods, and containers.
3. Bound time ranges, result counts, log lines, and bytes.
4. Normalize raw Kubernetes objects into compact diagnostic records.
5. Preserve requester identity and Kubernetes/Backstage authorization.
6. Redact secret-adjacent content before it reaches an LLM, artifact, or audit log.
7. Make a stable tool contract available to all three workflows.

That is exactly the kind of repeatable, AI-specific semantics that deserves a shared module.

## Refined Contract

I would expand the earlier diagnostics interface to cover deployment history and shift timelines from the beginning:

```ts
interface KubernetesDiagnosticsService {
  resolveWorkloads(input: {
    entityRef: string;
  }): Promise<KubernetesWorkloadRef[]>;

  getWorkloadSnapshot(input: {
    cluster: string;
    namespace: string;
    workload: string;
    kind?: 'Deployment' | 'StatefulSet' | 'DaemonSet';
  }): Promise<KubernetesWorkloadSnapshot>;

  getPodSnapshot(input: {
    cluster: string;
    namespace: string;
    pod: string;
  }): Promise<PodDiagnosticSnapshot>;

  getPodLogs(input: {
    cluster: string;
    namespace: string;
    pod: string;
    container?: string;
    previous?: boolean;
    since?: string;
    tailLines?: number;
    maxBytes?: number;
  }): Promise<PodLogExcerpt>;

  listWorkloadEvents(input: {
    cluster: string;
    namespace: string;
    workload?: string;
    pod?: string;
    since?: string;
    until?: string;
    limit?: number;
  }): Promise<KubernetesEventSummary[]>;

  getWorkloadTimeline(input: {
    entityRef?: string;
    cluster?: string;
    namespace?: string;
    workload?: string;
    since: string;
    until: string;
  }): Promise<KubernetesWorkloadTimeline>;
}
```

Stable tool IDs could be:

```text
kubernetes.workload.resolve
kubernetes.workload.get_snapshot
kubernetes.pod.get_snapshot
kubernetes.pod.get_logs
kubernetes.workload.list_events
kubernetes.workload.get_timeline
```

All of these should be `effect: 'read'`.

`getWorkloadTimeline` is the important addition prompted by `oncall-ai-handover-assistant`. It should normalize:

- Deployment generation and observed generation.
- Deployment conditions such as `ProgressDeadlineExceeded`.
- ReplicaSet revisions and creation timestamps.
- Pod lifecycle and container termination transitions.
- HorizontalPodAutoscaler status/current replicas when configured.
- Relevant Kubernetes Events.
- Rollout/revision identifiers.

“Configuration changes” needs careful wording: Kubernetes can show that a Deployment/ReplicaSet changed and which generation/revision became active, but it usually cannot provide a trustworthy human-readable diff of ConfigMap/Secret values. Never expose Secret data. For ConfigMaps, return only metadata, resource version, timestamps, and references unless a separately authorized configuration-diff capability exists.

## One Module, Not Three

Do not create separate adapters for responder, catalog insight, and handover. The workflow-specific interpretation belongs in each workflow:

- `kubernetes-ai-responder`: maps `OOMKilled` to memory investigation and `ImagePullBackOff` to image/registry/deployment investigation.
- `catalog-ai-insights`: turns snapshot/timeline evidence into “why did the last deployment fail?”
- `oncall-ai-handover-assistant`: summarizes bounded timeline events into a shift handover.

The Kubernetes module should only retrieve normalized facts. It should not decide root cause, assign blame, or compose the handover narrative.

## Interaction With Backstage Core

The implementation should be centered on the configured Backstage Kubernetes integration:

- Catalog annotations and the Kubernetes service locator resolve an entity to workloads/clusters.
- Core Kubernetes authentication strategies determine credentials.
- Core Kubernetes object retrieval handles the entity-oriented object query.
- The AI module adds only the diagnostic operations core Kubernetes does not offer as an injectable backend contract, especially bounded logs, event timelines, and normalized rollout history.

That is why this should be a shared adapter even though Kubernetes is “internal”: the core plugin does not expose a reusable `KubernetesService` ref for workflow modules, while the required diagnostic semantics are shared across at least three future workflows.

The Kubernetes diagnostics module is independent of cloud resource inventory. It
uses the configured Backstage Kubernetes integration for entity correlation,
cluster location, authentication, authorization, bounded retrieval, and
redaction. It exposes normalized workload, pod, log, event, and timeline facts
to the three workflows above.

Keep these responsibilities distinct:

- **Trigger:** alerts, webhook, or scheduler.
- **Investigation source:** Kubernetes diagnostics module.
- **Entity correlation:** catalog annotations plus Backstage Kubernetes service location.

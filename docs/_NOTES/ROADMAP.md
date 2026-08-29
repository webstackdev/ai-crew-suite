# Roadmap Items

We created an `_IMPLEMENTATION.md`  for each of the backend and frontend agentic workflow that follow the pattern `plugins/backend/plugin-ai-agent-backend-*` and `plugins/frontend/plugin-ai-agent-frontend-*`. We then implemented each of the paired backend and frontend plugins and I copied the chat output detailing completion into the `_IMPLEMENTATION.md` file with a few exceptions.

I realized after the fact that we had not implemented any actual LLM workflows for any of the plugins, and that several features for each paired set of backend / frontend plugins were not implemented waiting on additional functionality to be added to our core plugins like `plugins/backend/plugin-ai-core-backend`. I've tried to identify what those features are and aggregated them into groups:

1. We have groups of plugins that follow the naming schema `plugin-ai-core-backend-module-*` and provide unified access to external systems, like vector stores, and platforms like version control systems (VCS). Some of the blocked roadmap items are waiting on feature implementations in these plugins.
2. Our agentic workflow features using an LLM orchestrator are completely not implemented in any plugin pair. Some of the plugins don't have the agentic workflow features detailed below as insight into what it should be wasn't picked up in my attempts to distill out roadmap items, but is in the `_IMPLEMENTATION.md` file.
3. Some are blocked on implementation of features related to Backstage core and built-in capabilities, like Catalog and Kubernetes.
4. Some are specific to a paired backend / frontend feature set and not blocked on feature implementation in core or module plugins.

Please read the `_IMPLEMENTATION.md` file in each of the 18 agentic workflow plugin directories. Determine what our roadmap items. There is a "Roadmap" section at the bottom of each file that has the items I identified - these lists may not be complete or include items that don't belong.

Then, let's create a file in each of the plugin directories listed here that has features that need to be implemented named `_ROADMAP_IMPLEMENTATION.md`.  We don't need a detailed and complete implementation plan for each feature - just enough information that I can use it in a prompt to implement the feature.

One goal is that many plugins are blocked on the same feature to core plugins. I'd like to aggregate these together so I can then implement the features in core and modules. After that we can return to implementing the features in the agentic workflow plugins themselves.

At the end of the run, I'd like to answer the following question. Currently we have several orchestrators defined in `plugin-ai-core-backend`. I think that all eighteen agentic workflow plugins can use the `plugins/backend/plugin-ai-core-backend/src/orchestrators/LangGraphOrchestrator.ts` orchestrator, and I can remove the `CrewOrchestrator.ts` and `SingleShotOrchestrator.ts` orchestrators. But I'd like to confirm that.

## Agentic Workflow Plugins

Each plugin has a `_ROADMAP_IMPLEMENTATION.md` in its directory with prompt-ready items, split into "blocked on shared core/module work" and "plugin-local" groups. Headline blockers only:

### `plugin-ai-agent-backend-alert-ai-tuner`

Blocked on: `vcs.pull_request.create`/`vcs.branch.create` (publish milestone), Kubernetes diagnostics driver (deploy correlation), `CatalogEntityResolver` adapter consumption (annotation-based repo resolution).

### `plugin-ai-agent-backend-catalog-ai-insights`

Blocked on: `communication.message.post` for v1.1 Slack dispatch. Otherwise production-readiness + E2E items only.

### `plugin-ai-agent-backend-kubernetes-ai-responder`

Blocked on: the Backstage-aware `KubernetesDiagnosticsDriver` implementation (enablement gate for this and three other plugins). Post-v1 write actions need a future write-capable Kubernetes contract.

### `plugin-ai-agent-backend-oncall-ai-handover-assistant`

Blocked on: Kubernetes diagnostics driver (deploy signals); v1.1 dispatch needs `communication.message.post` / `incident.incident.annotate` behind approval.

### `plugin-ai-agent-backend-release-notes-ai-generator`

Blocked on: `vcs.release.publish` (write) and `vcs.repository.get_release_tags`/`compare` (read) for the publish milestone.

### `plugin-ai-agent-backend-rfc-adr-ai-reviewer`

Blocked on: `vcs.pull_request.comment` (write milestone); optional `token.node` event field (per-node token UI); AI Core events subscription (event-triggered runs).

### `plugin-ai-agent-backend-scaffolder-ai-drift-detector`

Blocked on: cloud-providers tool normalization (cloud reconciliation), `vcs.pull_request.create` (remediate milestone), core-node Scaffolder blueprint reader, Kubernetes diagnostics driver.

### `plugin-ai-agent-backend-scaffolder-ai-guardrail-agent`

Blocked on: Scaffolder pre-flight interception point for v2 enforcement (v1 is advisory); OPA approver-authorization policies are config work, not driver work.

### `plugin-ai-agent-backend-scaffolder-ai-infra`

Blocked on: shared Scaffolder helper surface + a real `ai:infra:generate` Scaffolder action for the write path; policy-validation-over-files, catalog ownership/duplicate adapters, and repository-blueprint sourcing are deferred integrations.

### `plugin-ai-agent-backend-scaffolder-ai-intent`

No core blockers — plan explicitly requires no new core machinery. Plugin-local hardening only (multi-turn correction, advisory policy checks, dry-run, name-collision self-healing).

### `plugin-ai-agent-backend-scaffolder-ai-prd`

Blocked on: `vcs.pull_request.create` (doc publishing only). Ticket hierarchy (`project.ticket.create` + `parentId`) and `scaffolderServiceRef.scaffold()` commit paths are available today behind the approval gate.

### `plugin-ai-agent-backend-scaffolder-ai-shadow-detective`

Blocked on: cloud-providers tool normalization (Milestone 0, hard gate — tools register as LangChain-shaped objects with no `id`/`invoke`/`effect`).

### `plugin-ai-agent-backend-search-ai-archeology`

Blocked on: `vcs.repository.list_commits` (authorship ranking), `listPullRequests` window/state/reviewers extension, `TicketSearchQuery` + `TimeRange`, `CatalogEntityResolver.findUserByEmail`. Viable on ticket evidence until then.

### `plugin-ai-agent-backend-search-ai-context`

Blocked on: AI Core events subscription (automatic runs only); real `searchRepository` for Bitbucket/Gerrit/generic Git improves coverage.

### `plugin-ai-agent-backend-tech-debt-ai-scout`

Blocked on: `quality.scorecard.publish_fact` write op (scorecard debt score). Ticket filing is available today behind the approval gate.

### `plugin-ai-agent-backend-tech-radar-ai-manager`

Blocked on: durable TechRadar proposal storage (proposals are in-memory today); recommended core `listArtifacts(filter)`; events subscription for PR-time alerts; VCS search coverage.

### `plugin-ai-agent-backend-techdocs-ai-janitor`

Blocked on: `vcs.pull_request.create` for `deliver.mode: pull_request` (ticket bridge mode works today); events subscription deferred.

### `plugin-ai-agent-backend-techdocs-ai-postmortem`

Blocked on: `vcs.pull_request.create` (publication; ticket bridge works today); events subscription for resolution triggers.



## Core Plugins for AI Crew Suite

Each has a `_ROADMAP_IMPLEMENTATION.md` with the aggregated detail.

### `plugin-ai-core-backend`

1. Events service integration (`coreServices.events` → authenticated trigger dispatch) — unblocks search-ai-context, techdocs-ai-postmortem, techdocs-ai-janitor, tech-radar, rfc-adr.
2. `listArtifacts(filter)` on `RunStore`/`ArtifactSink` — unblocks tech-radar longitudinal history, alert-tuner proposal lists, oncall brief history, drift fleet views.
3. Orchestrator consolidation decision (see answer at bottom of this file).
4. LLM-orchestrated workflow support is unimplemented everywhere (tool-calling `ModelExecutor`, per-node tokens); no plugin pair exercises it today.

### `plugin-ai-core-node`

1. `src/scaffolder/` helper library (blueprint/provenance reads; pre-flight hook surface for guardrail v2).
2. `CatalogEntityResolver.findUserByEmail` / `findByField` + `memberOf` traversal (search-ai-archeology).
3. Optional `node?: string` on the `token` event (rfc-adr, prd per-node token UI).
4. `TicketSearchQuery` extends `TimeRange` (search-ai-archeology).
5. Migrate the 17 non-`BaseGraphRunner` plugins onto `BaseGraphRunner` for Zod-enforced frontend contracts.

### `plugin-ai-core-backend-module-retrieval-augmenter`

No blockers; keep retrieval advisory (never sets verdicts/thresholds/parameters).


## Third-Party Platform Extension Module Plugins

Each has a `_ROADMAP_IMPLEMENTATION.md` with the aggregated detail.

### `plugin-ai-core-backend-module-cloud-providers`

Normalize `createCloudProviderTools` to real `ToolDefinition`s (`cloud.account.lookup`/`cloud.resource.lookup`/`cloud.resource.dependencies`, `effect: 'read'`, `invoke`) — hard gate for shadow-detective and drift-detector.

### `plugin-ai-core-backend-module-communication`

`communication.message.post` (`effect: 'write'`, approval-gated) for v1.1 dispatch in catalog-insights, oncall-handover, drift-detector.

### `plugin-ai-core-backend-module-compliance`

No blockers. Watch: approver-authorization OPA policies (guardrail), fail-closed semantics.

### `plugin-ai-core-backend-module-incident-management`

No blockers. Watch: window-bounded alert history; annotate audit path once consumed by oncall v1.1.

### `plugin-ai-core-backend-module-kubernetes`

Complete the Backstage-aware `KubernetesDiagnosticsDriver` — enablement gate for kubernetes-ai-responder, alert-ai-tuner, oncall-handover, drift-detector.

### `plugin-ai-core-backend-module-observability`

No blockers. Watch: graceful-degradation contract and query budgets.

### `plugin-ai-core-backend-module-project-management`

No blockers. Watch: honor `TimeRange` on ticket search once core-node adds it.

### `plugin-ai-core-backend-module-quality-scorecards`

1. `publishScorecardFact` op + `quality.scorecard.publish_fact` tool (tech-debt-ai-scout).
2. Durable TechRadar proposal storage honoring `techRadar.url` (tech-radar-ai-manager; techradar companion module).

### `plugin-ai-core-backend-module-vcs`

The biggest shared blocker — build once, consumed by 5+ plugins:
- Write: `vcs.pull_request.create`, `vcs.branch.create`, `vcs.pull_request.comment`, `vcs.release.publish` (all `effect: 'write'`).
- Read: `vcs.repository.list_commits` (required `TimeRange`), `get_release_tags`/`compare`, `listPullRequests` window/state/reviewers extension, real `searchRepository` for Bitbucket/Gerrit/generic Git.


## Core Module Plugins

No blocking items reported for any of these; each directory carries a `_ROADMAP_IMPLEMENTATION.md` noting the watch item (opt-in real-model evaluation telemetry expectations).

### `plugin-ai-core-backend-module-llm-aws`

### `plugin-ai-core-backend-module-llm-openai`

### `plugin-ai-core-backend-module-llm-openrouter`

### `plugin-ai-core-backend-module-runtime-store`

### `plugin-ai-core-backend-module-storage-pgvector`

### `plugin-ai-core-backend-module-storage-qdrant`

## Orchestrator Question — Answer

**Claim to verify**: all 18 agentic workflow plugins can use `LangGraphOrchestrator`, and `CrewOrchestrator` + `SingleShotOrchestrator` can be removed.

**Verdict: No — the premise is inverted.**

1. **None of the 18 plugins use any built-in orchestrator.** Every plugin registers a custom `WorkflowRunner` (via `workflowRunnerExtensionPoint`) and sets `workflowRef` on its agent; `AgentRuntime.run` prefers the workflow runner and never consults the orchestrator map for these agents. Only `alert-ai-tuner` extends `BaseGraphRunner`; the other 17 implement `WorkflowRunner` directly.
2. **`LangGraphOrchestrator` cannot host these workflows.** Per the kubernetes-ai-responder plan (verified in code): it only calls `knowledge.retrieve` and produces a generic retrieval-and-chat loop — no domain graph topology, no allow-listed multi-tool execution, no per-node checkpoints/approval gates. It is registered in `createOrchestrators` but selected by **no agent** (plugin or config) anywhere in the repo. It is the one orchestrator that is completely unused.
3. **`CrewOrchestrator` has exactly one consumer**: the placeholder `doc-janitor-crew` agent in `service/factory.ts` (lines 195–237 — it does exist there as a plain ASCII string). The rfc-adr plan explicitly rejected `orchestrator: 'crew'` because it is sequential; parallel fan-out must be a custom runner. Remove it only together with the `doc-janitor-crew` placeholder.
4. **`SingleShotOrchestrator` is the wired default**: `resolveConfiguredAgents` defaults `orchestrator` to `'single-shot'` (factory.ts:96), the placeholder `service-contextualizer` agent (factory.ts:184–193) uses it, it is the default agent for trigger/webhook fallback (`resolveDefaultAgentId`, controller.ts:381), and `AgentRuntime` falls back to it when an agent has no `workflowRef` and no explicit orchestrator. Removing it requires replacing all four fallback paths — e.g. requiring `workflowRef` on every agent and deleting the two placeholder agents.

**Recommendation**: the direction of travel is the opposite of the claim — the `WorkflowRunner`/`workflowRef` pattern (with `BaseGraphRunner` for Zod contracts) is what all 18 plugins actually use. If you want to simplify: keep `SingleShotOrchestrator` as the default-agent fallback (or delete the placeholder agents and require `workflowRef`), and remove `LangGraphOrchestrator` and `CrewOrchestrator` as genuinely unused/placeholder-only. Do not attempt to route the 18 plugins through `LangGraphOrchestrator`; extend the runner pattern instead. If a true LLM-orchestrated (tool-calling) workflow is desired later, build it as a shared executor under the `WorkflowRunner` contract rather than reviving the current `LangGraphOrchestrator`.


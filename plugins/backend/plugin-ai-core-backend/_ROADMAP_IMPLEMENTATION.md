# AI Core Backend — Aggregated Roadmap Items

Aggregated from the 18 agentic workflow plugins' `_ROADMAP_IMPLEMENTATION.md` files. Implement these in core first; the workflow plugins then consume them.

## 1. Events service integration (blocks automatic/event-triggered runs)

- **Gap**: no `coreServices.events`, no `eventsServiceRef`, no `EventsService` consumption anywhere; `TriggerBinding.source` is an unbacked free-form string.
- **Build**: subscribe AI Core (or a shared helper) to the Backstage events service and translate matching events into authenticated run dispatches through the existing trigger/run routes with idempotency keys.
- **Consumers**: search-ai-context (change-driven impact), techdocs-ai-postmortem (incident resolution), techdocs-ai-janitor (doc-audit events), tech-radar-ai-manager (PR-time alerts), rfc-adr-ai-reviewer (repo/scaffolder events).
- **Contract note**: keep request `source` fields discriminated in each plugin so the `event` variant is additive.

## 2. Artifact history reads (`listArtifacts(filter)`)

- **Gap**: `ArtifactSink.record()` is write-only; there is no artifact query on the runtime store.
- **Build**: add `listArtifacts(filter)` to `RunStore`/`ArtifactSink` (additive) so agents can read their own history.
- **Consumers**: tech-radar-ai-manager (longitudinal `AdoptionSnapshot` series; currently keeps a checkpoint-backed rolling series keyed by `observationSeriesId`), alert-ai-tuner (proposal-list endpoint), oncall-handover (scheduled-brief history), drift-detector (fleet drift views).

## 3. Orchestrator consolidation

- See the orchestrator answer in `docs/_NOTES/ROADMAP.md` discussion: all 18 workflow plugins execute through custom `WorkflowRunner`s via `workflowRef`; the built-in orchestrators are only reachable by the two placeholder agents in `service/factory.ts` (`service-contextualizer`, `doc-janitor-crew`) and config defaults. Decide whether to (a) keep `SingleShotOrchestrator` as the default for agents without `workflowRef`, or (b) require `workflowRef` on every agent and remove the built-in agents + unused orchestrators (`CrewOrchestrator`, `LangGraphOrchestrator`). `LangGraphOrchestrator` today only calls `knowledge.retrieve` and cannot host any plugin's domain graph.

## 4. LLM-driven workflow features (ROADMAP item 2)

- No plugin pair currently exercises a model-orchestrated workflow: every graph is deterministic code with the model used only for bounded, schema-validated synthesis/narration. If a genuinely LLM-orchestrated workflow is wanted, it needs: tool-calling support in `ModelExecutor`/`WorkflowContext` (model proposes tool calls, runtime executes them under allow-list + budgets), per-node token streaming (`token.node`, see core-node items), and the existing approval policy on write-effect tools. Until then, do not claim LangGraph-style orchestration in docs.

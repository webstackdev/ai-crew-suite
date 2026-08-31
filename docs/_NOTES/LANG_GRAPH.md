# Lang Graph

## Short answer

**No — they are not doing the same thing, in either direction.** The `*Graph` classes and `LangGraphOrchestrator` share only a superficial shape (an async generator yielding `AgentEvent`s with `step`/`token`/`done` events). Semantically they are quite different, and — importantly — `LangGraphOrchestrator` has nothing to do with the actual LangGraph library despite its name.

## What `LangGraphOrchestrator` actually does

Despite the name, it does **not** use `@langchain/langgraph` state graphs at all. It's a hand-rolled linear pipeline:

1. Load session history (last 8 messages)
2. Call `knowledge.retrieve` — **the only tool it ever invokes** (hard-coded)
3. Stream one LLM call over the retrieved embeddings, yielding `token` events
4. Persist session history + a checkpoint
5. A regex heuristic (`/\b(create|open|write|apply|update|delete|pr|issue)\b/i`) that emits a generic `approval_request` if any write tool exists in the registry

It is essentially `SingleShotOrchestrator` + session memory + a checkpoint + a regex-based approval guess. It cannot:

- invoke the agent's allow-listed tools (no tool-calling loop at all),
- branch or route between nodes based on intermediate results,
- resume mid-graph at a domain-specific gate (`handleApprovalInterrupt` is a heuristic side-channel, not a real graph interrupt with `resume()` continuation).

## What the `*Graph` classes actually do

`AlertTunerGraph`, `CatalogInsightsGraph`, `IncidentTriageGraph`, etc. are **domain state machines**: explicit multi-node pipelines where each node is deterministic code, routing decisions are computed from data, and the LLM is used (if at all) only in bounded, schema-validated synthesis steps:

- `AlertTunerGraph`: `observe → analyze → correlate → locate → patch → artifact`, with early exits for `insufficient_evidence` / `real_signal` / `anchor_not_found`. All decisions are pure code; the model never touches the patch.
- `CatalogInsightsGraph`: intent classification → tool-plan fan-out over many allow-listed tools → context normalization → cited model synthesis → report artifact, with graceful per-source degradation.
- Others add `Promise.all` parallel nodes (rfc-adr, prd), `resume()` approval gates that continue the graph after a human decision, per-node checkpoints, etc.

## Where they genuinely overlap

| Aspect                                                       | Both have                                                    |
| :----------------------------------------------------------- | :----------------------------------------------------------- |
| Async generator of `AgentEvent`s (`step`, `token`, `done`, `error`) | Yes — that's the shared `Orchestrator`/`WorkflowRunner` contract surface |
| Step enter/exit tracing with a sequence counter              | Yes (the plugin graphs copied this idiom)                    |
| Model invocation via the resolved model + system prompt      | Yes                                                          |
| Session memory, checkpoints, audit                           | Yes, but the plugin graphs get it via `WorkflowContext`/runtime; the orchestrator hand-rolls it |

So the plugin graphs are best understood as **reimplementing the \*useful\* parts of what a LangGraph-style orchestrator was supposed to provide (stateful multi-node execution), but as domain-specific, deterministic code** — while `LangGraphOrchestrator` itself is a retrieval-and-chat loop that happens to carry the LangGraph name.

## The real gap (ties back to your ROADMAP item 2)

What the name *promises* and neither side delivers is genuine **LLM-orchestrated graph execution**: the model deciding which node/tool to run next, with the runtime executing tool calls under the allow-list and budgets. Neither `LangGraphOrchestrator` (no tool calling at all) nor the `*Graph` classes (routing is hard-coded in TypeScript) do this. If you ever want that, the natural home is a new shared executor under the `WorkflowRunner` contract — not reviving the current `LangGraphOrchestrator`.

One naming nit worth knowing: since `LangGraphOrchestrator` doesn't use the LangGraph library, the name is actively misleading — another argument for removing or renaming it rather than treating it as the canonical runner for your 18 plugins.

One important finding first: **`@langchain/langgraph` is not installed anywhere in the repo.** All packages depend only on `@langchain/core` (the `langgraph` strings in `package.json` keywords and the orchestrator name are aspirational). So this is a genuine adoption decision, not a wiring fix. Here's how I'd approach it.

## Refactor to use Lang Graph Libraries

### Recommendation up front

**Do not replace the `\*Graph.ts` files' domain logic. Wrap LangGraph \*inside\* the `WorkflowRunner` contract, and rebuild `LangGraphOrchestrator`'s internals with it.** The plugin graphs' value is their deterministic, domain-specific routing and evidence handling — LangGraph should become the *execution substrate* (state channels, checkpointing, interrupts, streaming), not a rewrite of *what* each workflow decides.

### Design principles I'd apply

1. **Keep `WorkflowRunner` as the integration boundary.** `AgentRuntime` already prefers `workflowRef` over orchestrators; that contract stays. LangGraph gets used *behind* `run()`/`resume()`.
2. **Preserve the determinism posture.** Your plugins' core safety property is "decisions that affect infrastructure are pure code; the model only narrates." LangGraph supports this natively: nodes can be pure functions, conditional edges are deterministic predicates, and the model is only ever invoked inside a node. Do not move routing decisions into the model.
3. **Add LLM-orchestrated capability as a new shared executor, separately** (ROADMAP item 2) — a graph where the model *does* choose tools via `tool_calls`, still executed under the agent allow-list, budgets, and approval policy. That's a new thing, not a change to existing plugins.

### What code changes where

#### A. `plugin-ai-core-node` — contracts (add, don't break)

- Add `@langchain/langgraph` (and bump to compatible `@langchain/core` ^1.x) as a dependency.
- Add an optional helper base class alongside `BaseGraphRunner`, e.g. `LangGraphWorkflowRunner<TSchema, TState>`:
  - Internally: build a `StateGraph` with an `Annotation.Root` state definition (channels for evidence, limitations, errors).
  - Compile with a **checkpointer adapter** that bridges LangGraph's `BaseCheckpointSaver` to your existing `CheckpointStore` — this is the key integration win: LangGraph's interrupt/resume model then lands on your persisted, replayable runtime stores instead of its own memory savers.
  - Map LangGraph stream events (`streamMode: ['updates','messages','custom']`) onto your `AgentEvent` union (`step` enter/exit per node, `token`, `tool_call`/`tool_result`, `artifact`, `done`). This also gives you per-node token attribution for free, which is the open `token.node` roadmap item from rfc-adr/prd.
- Map `interrupt()`/`Command` to your `approval_request` / `ApprovalDecision` + `WorkflowRunner.resume()` contract. This replaces each plugin's hand-rolled checkpoint-at-gate + resume boilerplate.

#### B. `plugin-ai-core-backend` — replace the orchestrator's guts, keep its name/registration (or rename deliberately)

- Rewrite `LangGraphOrchestrator` as a *real* LangGraph graph: `load_history → retrieve → generate → persist`, with `interrupt()` for the approval guard instead of the regex heuristic. This turns it from a name-only impostor into either (a) a genuine generic retrieval-chat graph, or (b) if you go further, the tool-calling generic executor for agents without `workflowRef`.
- No changes needed in `AgentRuntime`/factory/router — the `Orchestrator` interface stays.

#### C. The 18 plugin `*Graph.ts` files — migrate incrementally, opt-in

Per plugin, the migration is mechanical once the base class exists:

| Hand-rolled today                                       | Replaced by LangGraph                |
| :------------------------------------------------------ | :----------------------------------- |
| `yield step('observe','enter')` … imperative sequencing | Nodes + edges on a `StateGraph`      |
| Ad-hoc `state` object threaded through                  | `Annotation` channels with reducers  |
| Checkpoint-before-gate + `resume()` replay logic        | `interrupt()` + checkpointer adapter |
| Parallel `Promise.all` fan-out (rfc-adr, prd)           | Native parallel branches + merge     |

What does **not** change: the pure engines (`noise.ts`, `correlate.ts`, `patch.ts`, `clustering.ts`, …), tool allow-lists, evidence/citation rules, Zod input schemas (still enforced by the `BaseGraphRunner`-style wrapper before the graph starts).

Suggested order: **pilot on `catalog-ai-insights`** (it has real model synthesis + session memory, so it exercises the most LangGraph value), then the approval-gated write workflows (alert-ai-tuner, techdocs-janitor) once the publish tools land — those benefit most from native interrupts. Pure-deterministic graphs like alert-ai-tuner's patch engine could honestly stay as-is; LangGraph adds little to a graph with no model-in-the-loop and no resume path.

### Honest cost/benefit

**You get:** real checkpoint/resume without hand-rolled logic, first-class interrupts matching your approval model, per-node streaming, and a path to true tool-calling orchestration later.

**You pay:** a new heavy dependency and its release cadence, an adapter layer to maintain (`CheckpointStore` ↔ `BaseCheckpointSaver`, event mapping), and a migration of 17–18 graphs that currently work. If the deterministic-graph posture is serving you well, the minimal viable adoption is: **rebuild `LangGraphOrchestrator` properly + ship the shared runner base class, then migrate only the plugins that need interrupts or model-in-the-loop routing.** The rest can keep their plain `WorkflowRunner` implementations — the contract already tolerates both.

Want me to sketch the `LangGraphWorkflowRunner` base class and the `CheckpointStore` adapter concretely (as a proposal doc or actual code)?

## Assessment of why we went Sideways

Honest answer: __I agree with half of it, and the half I'd push back on matters, because it changes what the fix is.__

## Where I agree with you

There is real duplication and it has the shape of a systemic mistake. The evidence is concrete:

- Every plugin hand-rolled the same execution machinery: `TunerToolRunner`, `InsightToolRunner`, `InvestigationToolRunner`, `HandoverToolRunner`, `ReviewToolRunner`, `DriftToolRunner`, `GuardrailToolRunner`, `ScoutToolRunner`, `HistoryToolRunner`… eighteen near-identical tool-invocation wrappers with budgets, limitations tracking, and timeouts.
- Every plugin re-implements step sequencing (`yield step('observe','enter')`), state threading, checkpoint-before-gate, and resume logic in `*Graph` classes.
- Your own responder plan (which became the template for all 18) __explicitly said not to do this__: *"Centralize how any workflow safely invokes a tool or model. Keep why a particular workflow investigates, routes, or summarizes in that workflow's package."* It specified shared `ToolExecutor`, `ModelExecutor`, `WorkflowEventSink`, `ArtifactWriter` services in core. __That middle layer was designed but never built.__ What actually shipped in `WorkflowContext` is a single `invokeTool()` on top of the raw `RunContext` — so each plugin had no choice but to build its own runner services.

So yes: the *execution substrate* you intended to live in core ended up reimplemented 18 times in an ad-hoc fashion. That's a fair critique.

## Where I'd push back

Two things complicate "we ignored the machinery we built":

1. __The three orchestrators were never capable of hosting these workflows.__ They're thin fork-era classes (Larder 2024 copyright headers — largely inherited, not machinery you spent time on): `SingleShot` is retrieve→one LLM call; `LangGraphOrchestrator` is the same plus session history, and despite its name never touches the LangGraph library; `Crew` is a sequential for-loop over roles. None of them can invoke allow-listed tools, branch on intermediate results, checkpoint mid-graph, or resume at a domain gate. Your responder plan recognized this and *deliberately* rejected extending them — it even warns "do not turn `LangGraphOrchestrator` into a central switch statement." The `workflowRef`/`WorkflowRunner` escape hatch was the documented, intended design, not a rogue path.
2. __So the failure wasn't choosing the wrong seam — it was never filling in beneath the seam.__ `WorkflowRunner` as the boundary is correct (domain graphs don't belong in core). What's missing is everything the plan assigned to core: the executor layer.

## Why it happened (my reconstruction)

The first plugin (kubernetes-ai-responder) needed capabilities the orchestrators didn't have, designed the `WorkflowRunner` escape hatch with the shared executor services as explicit *prerequisite shared work in core* — and then that shared work was never scheduled. Each subsequent plugin plan says "reuse the architecture proven by [previous plugin]," so the self-contained graph pattern calcified by copying. Nobody ever circled back to build the middle. Classic platform-team trap: the escape hatch became the road.

## What a plugin *should* look like on the intended infrastructure

The plugin contributes only declarative domain content:

```ts
export const alertTunerWorkflow = defineWorkflow({
  id: 'alert-tuning',
  inputSchema: AlertTunerInputSchema,
  state: AlertTunerState,                       // state channels
  nodes: { observe, analyze, correlate, locate, patch, narrate },
  edges: [ ... ],                               // deterministic predicates
  interruptBefore: ['publish'],                 // declarative approval gate
});
```

Core's executor provides: allow-list enforcement, tool budgets/timeouts/identity, `step`/`token`/`tool_*`/`artifact` event emission, checkpoint + interrupt + resume on your runtime stores, audit, artifact persistence, model resolution. `AlertTunerGraph.ts` shrinks to pure node functions (`noise.ts`, `patch.ts`, etc. unchanged) — no `TunerToolRunner`, no hand-rolled sequencing, no resume plumbing.

## Is my earlier suggestion preserving the wrong path as legacy?

Partially a fair hit. I proposed wrapping LangGraph *inside* each plugin's runner — which, taken literally, keeps the substrate duplicated per-plugin and just swaps what's inside the duplication. The better reading of your original vision: __put the graph substrate in core once__ (a shared `GraphWorkflowRunner` executor, LangGraph-based or hand-rolled, wired to your `CheckpointStore`/approval/audit), and reduce the 18 plugins to declarative workflow definitions registered through the existing extension point. `LangGraphOrchestrator` and friends then either get rebuilt as the generic default graph on that same executor or deleted — not preserved as a legacy tier.

The one thing I'd keep from my earlier answer: don't rewrite all 18 at once. Build the core executor, pilot one plugin (catalog-ai-insights) onto it to prove the contract, then migrate mechanically. And keep the deterministic pure engines — those were never the problem; the plumbing around them was.

## Summary

I wrote the full refactor plan to `/home/kevin/Repos/backstage/ai-crew-suite/docs/_NOTES/_CORE_REFACTOR.md`. Every claim in it is grounded in the actual code I read (factory, runtime, controller, orchestrators, extension points, `AgentEvent`/`Tool`/`CheckpointStore` types, `LlmService`, and the 18 plugins' `_IMPLEMENTATION.md` files). Highlights:

__Core design decisions:__

- __One engine, real LangGraph__: a `GraphExecutor` in `plugin-ai-core-backend` compiles declarative `WorkflowDefinition`s (Zod input schema, versioned state channels with reducers, pure node functions, deterministic edge predicates, declarative interrupts) contributed by plugins through the renamed `registerWorkflow` extension point.
- __The missing middle layer gets built__: `ToolExecutor` (allow-list, budgets, timeouts, audit, structural write-gating — write tools may only execute in nodes whose interrupt gate was approved *this run*), `ModelExecutor` (replaces `LlmService`, message-array prompts, per-node token attribution, and a safe tool-calling path where the model proposes and the engine disposes), and a single `EventMapper` — eliminating all 18 hand-rolled `*ToolRunner` classes.
- __Deleted outright__: all three orchestrators + their tests, `Orchestrator` type, `orchestrator`/`crew` fields, `BaseGraphRunner` (absorbed into engine input validation), `service-contextualizer`/`doc-janitor-crew` placeholders, and the default-agent fallback chain. `workflowRef` becomes required; a trigger without `agentId` is a boot error.
- __Real resume semantics__: `CheckpointStore` upgraded from opaque save/load to an append-only, idempotent, versioned `(runId, seq)` schema with `pendingApproval`, bridged to LangGraph's `BaseCheckpointSaver`; `paused` becomes a first-class run status; approver authorization is injectable with a compliance-module-backed implementation.
- __`AgentEvent` v2__: required `node` on token/tool events (closing the rfc-adr/prd roadmap item for free) and an exhaustive `ErrorCode` taxonomy.

__Migration discipline__: the plan is explicit that pure domain engines (`noise.ts`, `patch.ts`, `adjudicate.ts`, …) must not change — "if migrating a plugin requires touching its pure engines, the migration is wrong." A per-plugin checklist, a complexity-ordered pilot sequence (intent → catalog-insights → alert-tuner → rfc-adr → techdocs-janitor → remaining 13), an engine test suite as the merge gate, and a Definition of Done with grep-level checks close it out.

__One honest flag__: the plan pins `@langchain/langgraph` `^1.x` and prescribes the `StateGraph`/`Annotation`/`interruptBefore`/`Command({resume})` API surface — worth a quick verification pass against the exact 1.x API when you start step 2, since LangGraph's API shifted between 0.x and 1.x.

1. ### 1. __`SingleShotOrchestrator`__

   - __Used by__: `service‑contextualizer` (the default fallback agent)

   - __Usage scenario__: Only invoked when:

     1. A trigger/webhook request arrives without an `agentId` AND without a trigger‑specific `agentId`
     2. The runtime selects the default agent (`service‑contextualizer`)
     3. Since `service‑contextualizer` has no `workflowRef`, it falls back to its `orchestrator: 'single‑shot'`

   - __Reality__: All 18 plugins register triggers with explicit `agentId`, so this path is likely never taken in production.

   ### 2. __`CrewOrchestrator`__

   - __Used by__: `doc‑janitor‑crew` (example crew agent)
   - __Usage scenario__: Never invoked. `doc‑janitor‑crew` exists purely as an example and is not referenced by any trigger, route, or plugin.
   - __Status__: Pure placeholder/demo code.

   ### 3. __`LangGraphOrchestrator`__

   - __Used by__: __No agent whatsoever__
   - __No agent__ (plugin or config) sets `orchestrator: 'langgraph'`
   - __Zero runtime usage__

   ### 4. __The 18 Agentic‑Workflow Plugins__

   - __Pattern__: Each defines its own `WorkflowRunner` (or `BaseGraphRunner`) with a unique `workflowRef`
   - __Agent definitions__: All include `workflowRef: '<plugin‑specific‑id>'` and __no `orchestrator` field__
   - __Runtime behavior__: When an agent has a `workflowRef`, `AgentRuntime.run` selects the registered workflow runner __and skips the built‑in orchestrators entirely__.

Recommendation:

__`BaseGraphRunner` adoption__: Migrate the other 17 plugins to extend `BaseGraphRunner` for consistent Zod‑based contract validation.
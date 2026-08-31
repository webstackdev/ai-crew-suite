# 18 Agentic Workflow Plugins — Refactor Checklist

Generic, mechanical migration plan for every `plugin-ai-agent-backend-*` plugin to consume the refactored core/node/storage/LLM/extension surface. Apply this checklist **per plugin**, one at a time, in the migration order listed at the bottom. Assume the following are complete: `plugin-ai-core-node` (contracts + `WorkflowDefinition` DSL + extension points + test utils), `plugin-ai-core-backend` (engine + `ToolExecutor`/`ModelExecutor`/`EventMapper`), and the RAG/extension provider conversions.

**The 18 plugins** (in suggested migration order — complexity ascending):

1. `plugin-ai-agent-backend-scaffolder-ai-intent` (smallest graph, has a confirmation gate, no scheduler)
2. `plugin-ai-agent-backend-catalog-ai-insights` (session memory + model synthesis)
3. `plugin-ai-agent-backend-alert-ai-tuner` (deterministic multi-node, early exits)
4. `plugin-ai-agent-backend-rfc-adr-ai-reviewer` (parallel fan-out)
5. `plugin-ai-agent-backend-techdocs-ai-janitor` (interrupt + resume + idempotent redelivery)
6. Remaining 13 in any order: `plugin-ai-agent-backend-kubernetes-ai-responder`, `plugin-ai-agent-backend-oncall-ai-handover-assistant`, `plugin-ai-agent-backend-release-notes-ai-generator`, `plugin-ai-agent-backend-scaffolder-ai-drift-detector`, `plugin-ai-agent-backend-scaffolder-ai-guardrail-agent`, `plugin-ai-agent-backend-scaffolder-ai-infra`, `plugin-ai-agent-backend-scaffolder-ai-prd`, `plugin-ai-agent-backend-scaffolder-ai-shadow-detective`, `plugin-ai-agent-backend-search-ai-archeology`, `plugin-ai-agent-backend-search-ai-context`, `plugin-ai-agent-backend-tech-debt-ai-scout`, `plugin-ai-agent-backend-techdocs-ai-postmortem`, `plugin-ai-agent-backend-tech-radar-ai-manager`.

---

## Per-plugin checklist (apply to each)

Replace the hand-rolled class with a declarative `WorkflowDefinition` and rewire module registration. The pure domain engines (Zod schemas, pure helpers, prompt builders, citation validators, tool allow-lists) must not change. If migration requires touching those, the migration is wrong.

- [ ] **1. Inventory current shape**

  Record the current graph class shape (one of two):
  - `extends BaseGraphRunner<...>` (e.g. alert-ai-tuner)
  - `implements WorkflowRunner` directly (e.g. catalog-ai-insights at line 109, all others)

  Confirm which and note the state schema it threads today. `alert-ai-tuner` at line 75 (`extends BaseGraphRunner`); all others are direct-implementation.


- [ ] **2. Define `WorkflowStateSchema` for current state**

  - Build a Zod object schema mirroring the current hand-threaded state (evidence refs, limitations, intermediate collections, etc.).
  - Add `stateVersion: 1`.
  - Add per-channel reducers only if the current code appends/merges (e.g. limitations append, evidence merge). Default is last-write-wins.

- [ ] **3. Convert `executeGraph`/`run` into node functions**

  - Each `yield step('...','enter')`/`exit` block becomes a named node in `nodes: Record<string, WorkflowNode>`.
  - Each node returns a `Partial<TState>` (the state patch), never yields streaming events directly. Replace `yield { type: 'step' }` calls with the executor's automatic step emission.
  - Replace imperative sequencing with `edges`. Two edge shapes:
    - static: `{ from: 'observe', to: 'analyze' }`
    - conditional: `{ from: 'analyze', route: state => state.score.verdict === 'noisy' ? 'correlate' : END }`
  - Nodes must not decide routing except through typed state.

- [ ] **4. Replace hand-rolled `*ToolRunner` with `ctx.tools`**

  - Delete the per-plugin `*ToolRunner.ts` file and its test mock scaffolding.
  - Replace calls like `new TunerToolRunner(context, {...}).invoke(...)` with `ctx.tools.invoke<TArgs, TResult>({ toolId, args, limits })`.
  - Migrate the tool/mock tests to the shared `createTestNodeContext` harness from `plugin-ai-core-node/testUtils` (one fake, used by all).
  - Do not build a custom allow-list/budget/timeout wrapper — that's now `ToolExecutor` in core-backend.

- [ ] **5. Replace checkpoint/resume plumbing with declarative interrupts**

  - For every approval gate: replace manual checkpoint-before-gate + the graph class's `resume()` method with a `WorkflowInterrupt`:
    ```ts
    interrupts: [{
      beforeNode: 'publish',
      approvalRequest: state => ({ reason: '...', effect: 'write' }),
      applyDecision: (state, decision) => decision.status === 'approved' ? { approved: true } : { approved: false },
    }]
    ```
  - Delete `resume?(...)` and `CheckpointStore` save/load code from the plugin — the engine owns pause/resume mechanics.
  - If a plugin had an idempotent redelivery pattern (techdocs-janitor), its gate becomes the same declarative interrupt; the engine handles re-resume idempotency.

- [ ] **6. Emit artifacts through `ctx.emitArtifact`, not custom helpers**

  - Delete `createXxxArtifactEvent` helpers (e.g. `createInsightReportArtifactEvent`).
  - Call `ctx.emitArtifact(kind, payload)` instead. `kind` must be declared in `artifactKinds` on the definition.
  - Artifact persistence/SSE event is emitted by the engine.

- [ ] **7. Convert the class to a plain `WorkflowDefinition` export**

  - Delete `class XxxGraph ...` and `WorkflowRunner`/`BaseGraphRunner` imports.
  - Export instead: `export const xxxWorkflow = defineWorkflow({ id, inputSchema, state, entryNode, nodes, edges, interrupts, artifactKinds })`.
  - Zod input schema stays exactly as-is. The executor validates it.

- [ ] **8. Rewire module registration**

  In `src/module.ts`:
  - Replace `workflows.registerRunner(new XxxGraph(resolved))` with `workflows.registerWorkflow(xxxWorkflow)`.
  - Ensure `agents.addAgent(agent)` works with the new `AgentDefinition` (no `orchestrator` field; `workflowRef` already points to the workflow ID).
  - Keep scheduler/trigger/weekly-sweep registrations unchanged — they're orthogonal.

- [ ] **9. Update workflow tests to the shared harness**

  - Replace mock-express/mock-Contexts with `createTestNodeContext` and `runWorkflow(def, input, ctx)` from `plugin-ai-core-node/testUtils`.
  - Expected `AgentEvent` sequences re-recorded once against the engine and locked (byte-identical replay).
  - The old graph-class-specific mocks (e.g. `AlertTunerGraph` constructor options) delete with the class.

- [ ] **10. Update the frontend SSE reducer to `AgentEvent` v2 (per-plugin frontend package)**

  - Frontend types package exports the new union (with `node` on `token`/`tool_call`/`tool_result`/`approval_request`).
  - Per-node attribution UI gets a free upgrade where you already track nodes.
  - Do not update frontend until its backend module is migrated; the new event shape must be consumed by both sides together.

- [ ] **11. Migration quality bar per plugin (all must be true)**

  - `validateWorkflowDefinition(def)` returns `[]` at boot.
  - The plugin's pure domain tests (noise, correlate, locate, patch, clustering, intents, adjudicate, mutate, prompts, schemas) pass **unmodified**.
  - Workflow tests rewritten to `runWorkflow` assert the same `AgentEvent` shape (with node attributions populated).
  - `grep` returns no `class .*Graph`, no `implements WorkflowRunner`, no `extends BaseGraphRunner`, no `registerRunner`, no `TunerToolRunner`/etc., no `CheckpointStore` in the plugin src.
  - `grep` for `orchestrator` in the plugin returns nothing.

---

## Plugin-specific warnings to watch for

- **`alert-ai-tuner`** — only plugin extending `BaseGraphRunner`. Delete the class; the BaseGraphRunner input-validation job moves to the executor. Keep `AlertTunerInputSchema` untouched (it's a `ZodType`, works in `inputSchema`).
- **`catalog-ai-insights`** — uses session memory (`memory: 'session'`); resume relies on checkpoint after the model synthesis gate. Confirm `WorkflowInterrupt.applyDecision` correctly restores session-id continuity for follow-up questions.
- **`kubernetes-ai-responder`** — its fan-out pattern (parallel `Promise.all`) becomes parallel static edges from one node to a merge node.
- **`rfc-adr-ai-reviewer`** — parallel nodes with per-node token attribution; fan out and merge via two edges resolving to the same merge node.
- **`scaffolder-ai-intent`** — simplest graph; first migration to prove the engine.
- **`techdocs-ai-janitor`** — interrupt with idempotent redelivery; `deliver.mode` maps to a config-driven edge predicate. Do not build a second resume path.
- **`scaffolder-ai-prd`** — two of three commit paths use write-effects behind approval; treat each post-approval resume as one interrupt.
- **`search-ai-archeology`** — per-page checkpoint for rate-limit resilience; checkpoints after each collector page become edges with state, not hand-rolled checkpoint saves.
- **`guardrail-agent`** — v1 is advisory-only; watch the deterministic adjudication vs model-authored guidance split in its nodes.

## Execution sequence for all 18

1. `scaffolder-ai-intent` (smallest graph) — set up the engine consumption pattern.
2. `catalog-ai-insights` (session memory) — exercises hardest.
3. `alert-ai-tuner` (deterministic multi-node with early exits).
4. `rfc-adr-ai-reviewer` (parallel edges).
5. `techdocs-ai-janitor` (interrupt + resume gate).
6. Remaining 13 in any order (complexity is arbitrary now that the pattern is proven).

Schedulers, trigger bindings, and `AgentDefinition` metadata stay per-plugin unchanged; only the workflow shape and execution consumption move.

## Validation (no typecheck/lint/test run here)

- Boot-validation (`validateWorkflowDefinition`) returns `[]` for each migrated plugin.
- For each migrated plugin: old class shape deleted, new `WorkflowDefinition` exported, `registerWorkflow` used, workflow tests rewritten to the shared harness, the plugin's domain tests still pass unchanged, the plugin src has no `orchestrator`/`registerRunner`/`*ToolRunner`/`BaseGraphRunner`/`WorkflowRunner` references.
- Frontend SSE reducers updated to `AgentEvent` v2 in the same plugin change, not after.

## Done criteria for the 18 plugins

- All 18 plugins have completed the per-plugin checklist.
- The `grep` audit returns no legacy shapes anywhere.
- Every plugin uses `registerWorkflow`.
- The Definition of Done for the canonical core refactor (`_CORE_REFACTOR.md` §12) is satisfied because all 18 agents boot with `workflowRef` validated against a `WorkflowDefinition`.

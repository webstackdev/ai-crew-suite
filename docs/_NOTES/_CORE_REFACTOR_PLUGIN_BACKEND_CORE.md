# `plugin-ai-core-backend` — Refactor Implementation Steps

Greenfield execution engine for AI Core, built on `@langchain/langgraph`. This plugin owns the **single execution engine** (`GraphExecutor`), the runtime lifecycle (`AgentRuntime`), the HTTP/SSE surface (router/controller), the shared executors (`ToolExecutor`, `ModelExecutor`, `EventMapper`), and the checkpoint adapter. It consumes all contracts from `@webstackbuilders/plugin-ai-core-node`.

**Self-contained**: assume `plugin-ai-core-node` is fully refactored per `_CORE_REFACTOR_PLUGIN_BACKEND_NODE.md` and all extension module plugins (VCS, LLM, storage, drivers) already implement their side. This document fully specifies the refactor of this package independent of any other.

**Ground rules**: no backward compatibility. The three orchestrators, `LlmService`, and all `BaseLLM` paths are deleted. The engine is the only execution path.

---

## Current `src` tree (before)

```
src/
  index.ts
  plugin.ts
  setupTests.ts
  orchestrators/
    index.ts
    CrewOrchestrator.ts
    LangGraphOrchestrator.ts
    SingleShotOrchestrator.ts
    __tests__/CrewOrchestrator.test.ts
              LangGraphOrchestrator.test.ts
              SingleShotOrchestrator.test.ts
  runtime/
    index.ts
    AgentRuntime.ts
    LlmService.ts
    __tests__/AgentRuntime.test.ts
              LlmService.test.ts
  service/
    index.ts
    controller.ts
    factory.ts
    router.ts
    __tests__/controller.test.ts
              factory.test.ts
              router.test.ts
  tools/
    index.ts
    prompts.ts
    ToolPacks.ts
    ToolRegistry.ts
    __tests__/prompts.test.ts
              ToolRegistry.test.ts
  @types/index.ts
  testHelpers/index.ts
  utils/index.ts
  __tests__/configSchemaSync.test-d.ts
            plugin.test.ts
```

## Target `src` tree (after)

```
src/
  index.ts
  plugin.ts
  setupTests.ts
  runtime/
    index.ts
    AgentRuntime.ts            # rewritten: lifecycle/retries/persistence only
    GraphExecutor.ts           # NEW: the single LangGraph engine
    NodeHarness.ts             # NEW: per-node safety wrapper
    ToolExecutor.ts            # NEW: allow-list, budgets, effect-gating, routing
    ModelExecutor.ts           # NEW: replaces LlmService; chat models, tiers, tool-calling
    EventMapper.ts             # NEW: LangGraph stream -> AgentEvent v2
    LangGraphCheckpointer.ts   # NEW: CheckpointStore v2 <-> BaseCheckpointSaver adapter
    Redactor.ts                # NEW: configurable RedactionPolicy engine
    __tests__/
              AgentRuntime.test.ts
              GraphExecutor.test.ts
              NodeHarness.test.ts
              ToolExecutor.test.ts
              ModelExecutor.test.ts
              EventMapper.test.ts
              LangGraphCheckpointer.test.ts
              Redactor.test.ts
  service/
    index.ts
    controller.ts              # rewritten: httpAuth identity, permissions, live-tail SSE
    factory.ts                 # rewritten: no orchestrators/crew, category registries, validation
    router.ts                  # minor: ensure error middleware + auth wiring
    permissions.ts             # NEW: AI permission definitions + authorizer
    __tests__/controller.test.ts
              factory.test.ts
              router.test.ts
              permissions.test.ts
  tools/
        index.ts
        prompts.ts
        ToolPacks.ts
        ToolRegistry.ts   # unchanged
    __tests__/prompts.test.ts
              ToolRegistry.test.ts
  @types/index.ts              # rewritten: drop orchestrator/crew/crewrole, keep config+service types
  testHelpers/index.ts
  utils/index.ts
  __tests__/configSchemaSync.test-d.ts
            plugin.test.ts
```

**Deleted**: `orchestrators/` (entire dir + tests), `runtime/LlmService.ts` (+ test), all `BaseLLM` imports, `resolveBuiltInAgents`, `createOrchestrators`, `service-contextualizer`/`doc-janitor-crew` placeholders.


---

## Step 1 — Dependencies and the burn-down

- `package.json`: add `@langchain/langgraph` `^1.4.x` (runtime), align `@langchain/core` `^1.2.9`, keep `zod`, add `@backstage/errors`, `@backstage/plugin-permission-node` (for permission types), `@opentelemetry/api` (already present). Remove nothing else yet.
- Delete `src/orchestrators/` (all three classes + `index.ts` + all three test files).
- Delete `src/runtime/LlmService.ts` and `src/runtime/__tests__/LlmService.test.ts`.
- In `src/service/factory.ts`: delete `resolveBuiltInAgents` (the `service-contextualizer` / `doc-janitor-crew` placeholder agents), `createOrchestrators`, and the orchestrator/crew validation branches in `validateResolvedAgents`.
- Delete all `BaseLLM` imports and `BaseLLM | BaseChatModel` unions in `plugin.ts`, `service/controller.ts`, `service/factory.ts`, `@types/index.ts`. Model registries become `Map<string, BaseChatModel>`.
- Repo will not compile after this step — expected burn-down.

## Step 2 — `@types/index.ts` rewrite (internal service types)

Keep: `AiBackendConfig`, `AgentsMap`, `ToolMap`, `AiBackendServiceOptions`, `AiBackendServices`, `RouterOptions`, `RouteController`, `CreateRouterOptions`, `HardeningOptions`, `UsageMetadata`.

Change:
- `ModelRegistry = Map<string, BaseChatModel>` (was `BaseLLM | BaseChatModel`).
- `WorkflowRunnerMap = Map<string, WorkflowDefinition>` (was `WorkflowRunner`) — now keyed by workflow `id`, holding definitions not runner instances.
- Delete `CrewRole`.
- Add to `AiBackendConfig`: `ai.approval.authorizer?: 'default' | 'compliance'`, `ai.hardening.maxNodeDurationMs?: number`, `ai.redaction.*`, `ai.models.tiers?: Record<string,string>`, `ai.agents.<id>.providers`, `ai.agents.<id>.guardrails`, `ai.retention`. Remove `agents.*.orchestrator` and `agents.*.crew` from the config type.

Update `config.d.ts` at package root to match exactly (the `configSchemaSync.test-d.ts` test enforces this).

## Step 3 — `runtime/LangGraphCheckpointer.ts` (NEW)

Adapter from `CheckpointStore` v2 → LangGraph `BaseCheckpointSaver`:

- `get` / `getTuple` → `checkpointStore.getLatest(thread_id)`; map `CheckpointRecord` → LangGraph checkpoint tuple (`nextNode` → pending writes/channel versions).
- `put` / `putWrites` → `checkpointStore.put(record)`; build `CheckpointRecord` from graph state, stamp monotonic `seq`, `stateVersion` from the workflow definition, and `pendingApproval` when the graph is parked at an interrupt.
- `list` → `checkpointStore.list(thread_id)`.
- `deleteThread` → `checkpointStore.delete(runId)`.
- `thread_id = runId`. Idempotent `put` on `(runId, seq)` so engine retries cannot double-write.
- Runs all payloads through the `StateSerializer` (default JSON pass-through; KMS-encrypted when an enterprise registers one) via the runtime-store registration.

## Step 4 — `runtime/EventMapper.ts` (NEW)

Single owner of LangGraph stream → `AgentEvent` v2 translation:

- `updates` stream events → `step` (`node` enter/exit, monotonic `seq`).
- `messages` stream events → `token` with the originating node name attached (closes the per-node token attribution gap).
- `custom` events → pass-through typed events (`artifact`, `approval_request`).
- Tool dispatches → `tool_call` / `tool_result` with node attribution.
- Model `usage_metadata` → `usage` events (`node` set when attributable, else run-level).
- Node exceptions → `error` events with `code` from the thrown `NodeError`/`RetryableNodeError`, `retryable` flag, node name.

## Step 5 — `runtime/ToolExecutor.ts` (NEW)

Core-owned, single choke point for all tool invocation. Constructed per-run with the resolved `AgentDefinition`, the `ToolRegistry`, identity, logger, `RunStore`/`AuditLogSink`, hardening limits, and the active `RedactionPolicy`.

Responsibilities, in dispatch order:

1. **Allow-list check** against `agent.toolIds` — violation → `tool_denied` error event, audited.
2. **Provider restriction** — resolve the tool's category + provider; check against `agent.providers[category]`; mismatch → `tool_denied`, audited.
3. **RBAC provider filter** — drop providers the caller's permissions disallow before dispatch (fail-closed).
4. **Effect gating** — `effect: 'write'` tools may only execute in a node whose `interruptBefore` gate was approved *this run*; otherwise throw `tool_denied`. Structural approval policy (replaces the regex heuristic).
5. **Routing dispatch** — single-match (Explicit) via category `canHandle`, or scatter-gather (`invokeAll`) for categories declaring `supportsScatterGather`. Per-provider failures captured individually; ambiguity → typed limitation, never silent default.
6. **Budgets** — per-tool timeout, retry classification, invocation-count budget, `AbortSignal` wiring.
7. **Events + audit** — emit redacted `tool_call`/`tool_result` with node attribution; audit write-tool calls to `AuditLogSink`.

Public surface matches the `ToolExecutor` contract from core-node (`invoke` + optional `invokeAll`).


## Step 6 — `runtime/ModelExecutor.ts` (NEW, replaces LlmService)

- **Model resolution**: `resolveModel(agent)` maps `modelRef` (concrete ID or tier name) → `tiers.get(ref) ?? ref` → `modelRegistry.get(ref)`; boot-time throw on unknown tier/ref. Registry is `Map<string, BaseChatModel>`.
- **Tiers**: `forTier(name)` returns a `ModelExecutor` bound to a different resolved model (cheap vs reasoning). Tier names resolved from `ai.models.tiers` config.
- **Streaming**: `stream({ messages, tools? })` via LangChain callbacks; token chunks carry node attribution; `usage_metadata` accumulates to per-node + per-run `usage` events.
- **Message assembly**: `SystemMessage`/`HumanMessage` arrays; the `Human:\n…\nAssistant:` string-concat from `LlmService` is deleted. Prompt prefix/suffix config honored via `createPromptTemplates` (`tools/prompts.ts`).
- **Tool-calling support**: accepts `tools?: ToolSpec[]` (the agent's allow-listed read tools as JSON-schema specs). When the model emits `tool_calls`, does NOT auto-dispatch — yields a typed `PendingToolCalls` state patch; the workflow's edge predicate routes to the core-provided `execute_tool_calls` node, which dispatches through `ToolExecutor`. The model proposes; the engine disposes.
- **Guardrail classification**: when `agent.guardrails.input`/`output` is set, run input/output through the registered `GuardrailDefinition.classify`; `unsafe` → `error` event `code: 'guardrail_blocked'`, audited, stream halted.
- **Cooldown**: per-modelRef failure-count cooldown window (ADAPT of full circuit breaker), driven by `hardening.maxRetries`/`retryBackoffMs`.
- **Pre-egress redaction**: outbound prompt passes through the `RedactionPolicy` value-patterns before leaving for the provider (HIPAA/PHI layer).

## Step 7 — `runtime/NodeHarness.ts` (NEW)

Per-node safety wrapper applied to every plugin node function before it's added to the graph:

- **State validation**: Zod-parse the returned state patch against the workflow's `state.schema`; reject unknown keys; apply per-channel reducers. Malformed → `state_validation` error event, never a corrupted checkpoint.
- **Budget accounting**: per-node wall-clock (`maxNodeDurationMs`), cumulative token budget (`maxTotalTokens`), cumulative tool-invocation count. Exceeding any → `budget_exceeded` error + LangGraph cancellation (not a thrown string).
- **Redaction**: apply `Redactor` to state patches before they enter channels, and to checkpoint payloads.
- **Structured errors**: catch node exceptions → classify to `ErrorCode` + `retryable` via `NodeError`/`RetryableNodeError` → surface as `error` events with node name. Unknown exceptions → `unknown` + full server-side log, no payload leak.
- **OTel**: `ai.node.*` span per node (attributes: runId, agentId, workflowRef, node, attempt).
- **Structured logs**: `logger.info(..., { runId, node, workflowId })` on enter/exit/error.

## Step 8 — `runtime/GraphExecutor.ts` (NEW — the single engine)

Construction (boot): `compileWorkflow(def)` →

1. Build `StateGraph` with `Annotation.Root` state channels derived from `def.state.schema` + `def.state.reducers`.
2. Add each node wrapped in `NodeHarness`.
3. Wire `def.edges` (static + conditional `route` predicates).
4. Attach `def.interrupts` as LangGraph `interruptBefore` boundaries.
5. Compile with `LangGraphCheckpointer` (thread_id = runId).
6. Run `validateWorkflowDefinition(def)` static checks — fail boot on any violation (plus agent-level validation in factory).

Run: 

1. Validate input against `def.inputSchema` (absorbs `BaseGraphRunner`'s job).
2. `graph.stream(validatedInput, { streamMode: ['updates','messages','custom'] })` → `EventMapper` → `AgentEvent` v2.
3. On interrupt: persist checkpoint with `pendingApproval`, emit `approval_request`, end stream cleanly with run status `paused`.
4. Resume: `graph.stream(Command({ resume: decisionPatch }))` from the checkpoint after the controller verifies the approval.

## Step 9 — `runtime/Redactor.ts` (NEW)

Engine for the `RedactionPolicy` from core-node: applies `keyPatterns` (key-name match) and `valuePatterns` (credential-shape scan) to arbitrary payloads, honoring `mode: 'redact' | 'reject'`. Used by `NodeHarness` (state/checkpoint) and `ModelExecutor` (pre-egress). Default `DEFAULT_REDACTION_POLICY` is the secure floor; operators append via `ai.redaction.*` config but cannot weaken the built-in floor.

## Step 10 — `runtime/AgentRuntime.ts` rewrite

Shrink to lifecycle only. Constructor now takes `(agents, workflowDefinitions, executors, checkpointer, stores, hardening)`.

- Resolve agent → `workflowRef` → `WorkflowDefinition` (boot-validated; unknown ref = boot error, not first-run).
- `run()`: create run record → retry loop (`maxRetries`, exponential backoff) → drive `GraphExecutor` → pipe events through `EventMapper` → persist run steps, artifacts, audit, usage to `RunStore`/`ArtifactSink`/`AuditLogSink`/`UsageSink`. Update `RunRecord.status` (`running|paused|done|error|cancelled`).
- `resume()`: verify pending approval, apply decision, resume via `GraphExecutor`.
- `cancel()`: abort via signal → `cancelled` terminal state → resumable checkpoint.
- No knowledge of "nodes" — that's the executor's domain. Delete `SENSITIVE_KEYS`/`redact` (moved to `Redactor`).

## Step 11 — `service/permissions.ts` (NEW)

AI permission definitions + authorizer using the modern contract only (`@backstage/backend-plugin-api`, `coreServices.permissions.authorize`) — no `createPermissionIntegrationRouter`:

- Permissions: `ai.agent.run`, `ai.agent.approve`, `ai.run.read` (defined here or in a shared common package; resource-scoped where needed).
- `ApprovalAuthorizer` implementation backed by `compliance.permission.check` per exception class when `ai.approval.authorizer: 'compliance'` (developer cannot self-approve); default authenticated-anyone otherwise.


## Step 12 — `service/controller.ts` rewrite

- **Identity (bug fix)**: wire `coreServices.httpAuth`; extract verified `UserRef` from request tokens into `RunContext.identity` (strict, non-nullable). Delete the hardcoded `identity: 'anonymous'` at lines 324 and 517. Scheduled/trigger runs use the service principal, explicitly labeled.
- **Authorization**: evaluate `coreServices.permissions.authorize(...)` before `startRun` (`ai.agent.run`), `approveRun` (`ai.agent.approve`), `streamRunEvents` (`ai.run.read` scoped to owning identity/session — fixes the IDOR at line 348 where any runId replays with zero auth).
- **Typed HTTP errors**: map `ErrorCode` → `@backstage/errors` (`invalid_input`→`InputError`, missing run→`NotFoundError`, stale approval→`ConflictError`, denial→`NotAllowedError`) at the boundary. One switch.
- **SSE live-tail**: `streamRunEvents` replays persisted steps; if run status is `running`, continue streaming live (fixes the reconnect gap).
- **Approval flow**: `approveRun` verifies `pendingApproval.approvalId`, runs `ApprovalAuthorizer`, calls `runtime.resume`; decision + approver + checkpoint seq + state hash audit-logged before resume.
- Remove `?? this.defaultAgentId` fallbacks in `triggerRun`/`webhookRun` (triggers must bind explicit `agentId`; missing = 422/boot validation error).
- Keep rate limiting (`consumeRateLimit`), idempotency-key dedup, SSE helpers, timeout/abort wiring, `fromStoredStep`/`writeEvent` (updated for AgentEvent v2).

## Step 13 — `service/router.ts`

- Keep `MiddlewareFactory.create({config,logger}).error()`; add a test that unhandled throws → sanitized 500 with no stack leak.
- Ensure `httpAuth` + `permissions` are available to the controller (deps wired through `createRouter`/`bindRoutes`).
- Route surface unchanged: `/embeddings/:source`, `/agents`, `/agents/:id/runs`, `/runs/:id/events`, `/runs/:id/approvals`, `/triggers/:source`, `/webhooks/:provider`.

## Step 14 — `service/factory.ts` rewrite

- Delete `resolveBuiltInAgents`, `createOrchestrators`, `resolveDefaultAgentId`, and all crew/orchestrator validation. Remove `SingleShotOrchestrator`/`LangGraphOrchestrator`/`CrewOrchestrator` imports.
- Build category model registries from the new extension points (chat, embeddings, transcription, reranking, guardrail) instead of the old single `models` map; keep a `Map<string, BaseChatModel>` for chat used by `ModelExecutor`.
- Build `ToolExecutor`, `ModelExecutor`, `EventMapper`, `Redactor`, `LangGraphCheckpointer`; wire stores (`CheckpointStore`, `RunStore`, `ArtifactSink`, `AuditLogSink`, `UsageSink`) + `StateSerializer`.
- `validateResolvedAgents`: unknown model/tool/`workflowRef` → boot error; workflow definitions validated via `validateWorkflowDefinition`; triggers must bind explicit `agentId`. Drop the crew-roles check.
- Boot-time probes: `CheckpointStore` `SELECT 1`, model registry ping, config schema validation — fail loud.

## Step 15 — `plugin.ts` rewrite

- Remove `BaseLLM` import; model map is `Map<string, BaseChatModel>`.
- Register the new extension points (category model points, `vectorStoreExtensionPoint`) and the workflow point (renamed `registerWorkflow`).
- Wire `coreServices.httpAuth` + `coreServices.permissions` into the init deps and pass to `createAiBackendServices`.
- `createAiBackendServices` returns the engine-backed services (runtime = `AgentRuntime` over `GraphExecutor`).

## Step 16 — `tools/` (unchanged)

Keep `ToolRegistry.ts`, `ToolPacks.ts`, `prompts.ts` and their tests as-is. `createDefaultToolPackTools` and `InMemoryToolRegistry` still satisfy the `ToolRegistry` contract consumed by `ToolExecutor`.

## Step 17 — Validation

- `node .yarn/sdks/typescript/bin/tsc --noEmit -p plugins/backend/plugin-ai-core-backend` — clean.
- `yarn lint plugins/backend/plugin-ai-core-backend`.
- Engine suite green (`runtime/__tests__/`): synthetic linear+branch+parallel+interrupt+retryable workflow through `GraphExecutor` with `FakeChatModel` + scripted tools — event ordering, checkpoint contents per boundary, approve/reject resume, budget aborts, cancel mid-node, malformed state rejection, write-tool gating, idempotent re-resume, state-version mismatch refusal, guardrail block.
- `__tests__/plugin.test.ts` updated: agent with no `workflowRef` → boot error; trigger with no `agentId` → boot error.
- `configSchemaSync.test-d.ts` passes with the new `config.d.ts`.
- Confirm zero references to `Orchestrator`, `LlmService`, `service-contextualizer`, `doc-janitor-crew`, `BaseLLM`, `crew` in `src/`.

## Done criteria for this package

- One execution engine (`GraphExecutor`); `grep -r "orchestrator" src/` returns nothing.
- `AgentRuntime` = lifecycle only; all orchestration mechanics in `GraphExecutor`/`NodeHarness`/`ToolExecutor`/`ModelExecutor`/`EventMapper`.
- Identity is verified `UserRef` everywhere; RBAC enforced on all three mutating/reading run routes; `streamRunEvents` IDOR closed.
- Approval-gated write workflow can be started, paused, process-restarted, approved, resumed, completed — byte-identical replay, exactly one side effect.
- No `BaseLLM`; chat models resolve through category registries; tiers work.


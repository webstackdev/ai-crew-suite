# `plugin-ai-core-node` — Refactor Implementation Steps

Greenfield contract surface for AI Core. This plugin owns **types, contracts, extension points, and shared test utilities** — zero runtime execution logic. Everything here is a pure type/interface/contract plus small pure helpers.

**Self-contained**: assume all external module plugins already implement their side of the contracts. This document fully specifies the refactor of this package independent of any other.

**Ground rules**: no backward compatibility; the package's public API is rebuilt. Consumers (`plugin-ai-core-backend`, the 18 agentic plugins, all extension modules) are updated in their own separate refactors.

---

## Current `src` tree (before)

```bash
src/
  index.ts
  extensions.ts
  setupTests.ts
  @types/
    index.ts
    agent.ts
    cloud.ts
    common.ts
    communication.ts
    compliance.ts
    incidentManagement.ts
    kubernetes.ts
    observability.ts
    projectManagement.ts
    qualityScorecards.ts
    rag.ts
    run.ts
    session.ts
    source.ts
    tool.ts
    vcs.ts
    vector.ts
  catalog/
    index.ts
    mapping.ts 
    types.ts
    __tests__/mapping.test.ts
  runner/
    index.ts
    BaseGraphRunner.ts
    __tests__/BaseGraphRunner.test.ts
```

## Target `src` tree (after)

```
src/
  index.ts
  extensions.ts
  setupTests.ts
  @types/
    index.ts
    agent.ts            # rewritten: workflowRef required, providers policy, no orchestrator/crew
    cloud.ts
    common.ts
    communication.ts
    compliance.ts
    incidentManagement.ts
    kubernetes.ts
    observability.ts
    projectManagement.ts
    qualityScorecards.ts
    rag.ts
    session.ts
    source.ts
    tool.ts
    vector.ts
    vcs.ts              # widened: VcsProviderId -> string (branded)
    run.ts              # rewritten: AgentEvent v2, CheckpointStore v2, ErrorCode, RunContext
  catalog/
    index.ts
    mapping.ts
    types.ts
    __tests__/mapping.test.ts
  workflow/             # NEW: the workflow-definition DSL
    index.ts
    definition.ts       # WorkflowDefinition, WorkflowStateSchema, nodes/edges/interrupts
    context.ts          # NodeExecutionContext, ToolExecutor, ModelExecutor contracts
    errors.ts           # ErrorCode, NodeError, RetryableNodeError
    validation.ts       # validateWorkflowDefinition (pure, boot-time static checks)
    __tests__/definition.test.ts  __tests__/validation.test.ts
  events/               # NEW: AgentEvent v2 union
    index.ts
    agentEvent.ts       # the event union + ErrorCode
  stores/               # NEW: persistence contracts
    index.ts
    checkpoint.ts       # CheckpointStore v2, CheckpointRecord, StateSerializer, PersistedCheckpoint
    usage.ts            # UsageSink contract (structured usage table)
  redaction/            # NEW
    index.ts
    policy.ts           # RedactionPolicy contract + secure defaults
  models/               # NEW: model capability category contracts
    index.ts
    chat.ts             # ChatModelDefinition (BaseChatModel only)
    embeddings.ts       # EmbeddingsDefinition
    transcription.ts    # TranscriptionDefinition
    reranking.ts        # RerankingDefinition
    guardrail.ts        # GuardrailDefinition (uniform safe/unsafe verdict)
  testUtils/            # NEW: shared test harness
    index.ts
    runWorkflow.ts      # runWorkflow harness
    nodeContext.ts      # createTestNodeContext
    fakeModel.ts        # FakeChatModel
    contractTests.ts    # defineDriverContractTests scaffold
    __tests__/nodeContext.test.ts
```

**Deleted**: `runner/` (BaseGraphRunner absorbed into engine input validation), the `Orchestrator` interface, `orchestrator`/`crew` fields on `AgentDefinition`.


---

## Step 1 — Dependencies and cleanup

- `package.json`: add `@langchain/langgraph` (types only, `^1.4.x`), align `@langchain/core` to `^1.2.9`, keep `zod`. Add `@langchain/core` type imports where used (`BaseChatModel`, `Embeddings`). Remove nothing else.
- Delete `src/runner/` entirely (`BaseGraphRunner.ts`, `index.ts`, `__tests__/`). Its defensive-parse job moves to the engine in core-backend.
- Delete the `Orchestrator` interface from `@types/run.ts`, and remove `orchestrator`/`crew` from `@types/agent.ts` (full rewrite below).

## Step 2 — `@types/run.ts` rewrite (the runtime contracts)

Rewrite to contain only: `AgentRunInput`, `RunContext`, `WorkflowContext`, `WorkflowRunner`, `ToolInvocationLimits`, `ToolInvocationResult`, `ApprovalDecision`/`ApprovalRequest`, `SessionMessage`, `RunRecord`, `RunStepRecord`, `ArtifactSink`, `AuditLogSink`, `RunStore`, `SessionStore`. Changes:

- `AgentEvent` union → moved out to `events/agentEvent.ts` (re-exported here for convenience).
- `CheckpointStore` (old `save`/`load` blob) → moved to `stores/checkpoint.ts` (new versioned contract).
- `RunContext` gains `identity: string` (strict, non-nullable — no `'anonymous'` default), keeps `logger`, `toolRegistry`, `model`, `systemPrompt?`, `signal?`, `sessionStore?`, `checkpointStore?`, `runStore?`, `artifactSink?`, `auditLogSink?`, `hardening?`. `model` narrows to `BaseChatModel`.
- `WorkflowContext = RunContext & { agent: AgentDefinition }` (unchanged shape; `invokeTool` moves to the `ToolExecutor` contract in `workflow/context.ts`).

## Step 3 — `events/` — `AgentEvent` v2 + `ErrorCode`

`events/agentEvent.ts`:

```ts
export type AgentEvent =
  | { type: 'step'; data: { runId: string; seq: number; node: string; phase: 'enter'|'exit' } }
  | { type: 'token'; data: { runId: string; node: string; text: string } }   // node REQUIRED
  | { type: 'tool_call'; data: { runId: string; node: string; tool: string; args: unknown } }
  | { type: 'tool_result'; data: { runId: string; node: string; tool: string; ok: boolean; summary?: string; output?: unknown } }
  | { type: 'usage'; data: { runId: string; node?: string; input: number; output: number; total: number } }
  | { type: 'approval_request'; data: { runId: string; approvalId: string; node: string; reason: string; effect: 'write' } }
  | { type: 'artifact'; data: { runId: string; kind: string; url?: string; ref?: string } }
  | { type: 'done'; data: { runId: string; sessionId?: string } }
  | { type: 'error'; data: { runId: string; node?: string; code: ErrorCode; retryable: boolean; message: string } };

export type ErrorCode =
  | 'invalid_input' | 'tool_failed' | 'tool_denied' | 'model_failed'
  | 'budget_exceeded' | 'cancelled' | 'timeout' | 'state_validation'
  | 'interrupted' | 'guardrail_blocked' | 'unknown';
```

## Step 4 — `@types/agent.ts` rewrite

```ts
export type AgentDefinition = {
  id: string;
  modelRef: string;               // concrete ID or tier name (resolved by ModelExecutor)
  workflowRef: string;            // REQUIRED — no orchestrator fallback
  systemPrompt: string;
  toolIds: string[];
  memory?: 'none' | 'session';
  triggers?: TriggerBinding[];
  /** Per-category provider allow-list. Absent = any registered provider. */
  providers?: Record<string, readonly string[]>;   // e.g. { communication: ['slack'] }
  /** Per-agent guardrail enforcement. */
  guardrails?: { input?: boolean; output?: boolean };
};
// TriggerBinding unchanged. ModelDefinition REMOVED from here (moved to models/chat.ts).
```

Delete the `crew` field, `orchestrator` field, `ModelDefinition`, `ModelExtensionPoint` references.

## Step 5 — `@types/vcs.ts` provider-ID widening

```ts
// Before: export type VcsProviderId = 'github' | 'gitlab' | 'bitbucket' | 'azuredevops';
export type VcsProviderId = string & { readonly __brand?: 'VcsProviderId' };
// Known IDs exported as constants for autocomplete:
export const VCS_PROVIDERS = { GITHUB: 'github', GITLAB: 'gitlab', BITBUCKET: 'bitbucket', AZURE: 'azuredevops' } as const;
```

Apply the same widening to `CloudProviderId` in `@types/cloud.ts` and any other provider-ID union in the driver contract files. Driver registry treats IDs as map keys — union is pure friction.


## Step 6 — `workflow/` — the definition DSL (new directory)

`workflow/definition.ts`:

```ts
import type { ZodType } from 'zod';
import type { ApprovalDecision } from '../@types/run';

export type WorkflowStateSchema<TState> = {
  schema: ZodType<TState>;
  reducers?: { [K in keyof TState]?: (prev: TState[K], next: TState[K]) => TState[K] };
  stateVersion: number;
};

export type WorkflowNodeInput<TState, TInput> = {
  state: TState;
  input: TInput;
  ctx: NodeExecutionContext;
};

export type WorkflowNode<TState, TInput> =
  (node: WorkflowNodeInput<TState, TInput>) => Promise<Partial<TState>>;

export const END: unique symbol = Symbol('END');
export type WorkflowEdge<TState> =
  | { from: string; to: string }
  | { from: string; route: (state: TState) => string | typeof END };

export type WorkflowInterrupt<TState> = {
  beforeNode: string;
  approvalRequest: (state: TState) => { reason: string; effect: 'write' };
  applyDecision: (state: TState, decision: ApprovalDecision) => Partial<TState>;
};

export type WorkflowDefinition<TState = unknown, TInput = unknown> = {
  id: string;
  inputSchema: ZodType<TInput>;
  state: WorkflowStateSchema<TState>;
  entryNode: string;
  nodes: Record<string, WorkflowNode<TState, TInput>>;
  edges: WorkflowEdge<TState>[];
  interrupts?: WorkflowInterrupt<TState>[];
  artifactKinds: readonly string[];
};
```

`workflow/context.ts` — plugin-facing execution context contracts:

```ts
export type ToolExecutor = {
  invoke<TArgs = unknown, TResult = unknown>(input: {
    toolId: string; args: TArgs; limits?: ToolInvocationLimits;
  }): Promise<ToolInvocationResult<TResult>>;
  /** Scatter-gather over all providers allowed for this call. Opt-in per category. */
  invokeAll?<TArgs = unknown, TResult = unknown>(input: {
    toolId: string; args: TArgs; limits?: ToolInvocationLimits;
  }): Promise<ToolInvocationResult<TResult>[]>;
};

export type ModelExecutor = {
  stream(input: { messages: ChatMessage[]; tools?: ToolSpec[] }): AsyncIterable<ModelChunk>;
  invoke(input: { messages: ChatMessage[] }): Promise<string>;
  forTier(tier: string): ModelExecutor;   // cheap vs reasoning split
};

export type NodeExecutionContext = {
  logger: LoggerService;
  tools: ToolExecutor;
  model: ModelExecutor;
  emitArtifact(kind: string, payload: { ref?: string; url?: string }): Promise<void>;
  now(): Date;
  signal: AbortSignal;
};
```

`workflow/errors.ts`:

```ts
import type { ErrorCode } from '../events/agentEvent';
export class NodeError extends Error {
  constructor(message: string, readonly code: ErrorCode, readonly retryable = false) { super(message); }
}
export class RetryableNodeError extends NodeError {
  constructor(message: string, code: ErrorCode = 'tool_failed') { super(message, code, true); }
}
```

`workflow/validation.ts` — `validateWorkflowDefinition(def)`: pure static checks (unknown edge endpoints, unreachable nodes, interrupt on missing node, artifact-kind mismatch, missing input schema, missing `stateVersion`). Returns a list of violations; boot path throws on any.

## Step 7 — `stores/` — persistence contracts (new directory)

`stores/checkpoint.ts`:

```ts
export interface CheckpointStore {
  put(record: CheckpointRecord): Promise<void>;          // idempotent on (runId, seq)
  getLatest(runId: string): Promise<CheckpointRecord | undefined>;
  list(runId: string): Promise<CheckpointRecord[]>;
  delete(runId: string): Promise<void>;
}
export type CheckpointRecord = {
  runId: string; seq: number; nextNode?: string;
  state: unknown; stateVersion: number;
  pendingApproval?: { approvalId: string; node: string; reason: string };
  createdAt: string;
};
export interface StateSerializer {
  readonly serializerId: string;
  serialize(record: CheckpointRecord): Promise<PersistedCheckpoint>;
  deserialize(record: PersistedCheckpoint): Promise<CheckpointRecord>;
}
export type PersistedCheckpoint = {
  runId: string; seq: number; payload: Uint8Array | string; serializerId: string;
  nextNode?: string; stateVersion: number; createdAt: string;
};
```

`stores/usage.ts` — `UsageSink` contract: `record(entry: UsageRecord): Promise<void>` with `UsageRecord = { runId, agentId, workflowRef, node?, modelRef, input, output, total, createdAt }`. Plus a `listUsage(filter)` read for the future cost-monitoring plugin.

## Step 8 — `redaction/` — configurable redaction policy (new directory)

`redaction/policy.ts`:

```ts
export type RedactionPolicy = {
  keyPatterns: RegExp[];       // key-name matching (superset of today's SENSITIVE_KEYS)
  valuePatterns: RegExp[];     // credential-shape scanning on values
  mode: 'redact' | 'reject';
};
export const DEFAULT_REDACTION_POLICY: RedactionPolicy;  // secure floor; operators append, cannot weaken
export function createRedactor(policy: RedactionPolicy): (value: unknown) => unknown;
```

## Step 9 — `models/` — capability category contracts (new directory)

One file per category, each: a `*Definition` type (id + provider instance) + the contract the provider must satisfy.

- `chat.ts`: `ChatModelDefinition { id: string; model: BaseChatModel }` — **BaseChatModel only** (BaseLLM removed).
- `embeddings.ts`: `EmbeddingsDefinition { id: string; embeddings: Embeddings }`.
- `transcription.ts`: `TranscriptionDefinition { id: string; transcribe(input: { audio: Uint8Array; mimeType?: string }): Promise<{ text: string }> }`.
- `reranking.ts`: `RerankingDefinition { id: string; rerank(input: { query: string; documents: { id: string; text: string }[] }): Promise<{ id: string; score: number }[]> }`.
- `guardrail.ts`: `GuardrailDefinition { id: string; classify(input: { text: string; direction: 'input' | 'output' }): Promise<{ verdict: 'safe' | 'unsafe'; categories?: string[]; message?: string }> }` — uniform verdict so the engine blocks uniformly.


## Step 10 — `extensions.ts` rewrite

Rewrite the extension points. Keep the existing proven ones; remove `modelExtensionPoint`; add per-category model points and the new store/serializer point.

Keep (unchanged shape): `agentExtensionPoint`, `sourceExtensionPoint`, `toolExtensionPoint`, `triggerExtensionPoint`, and all driver points (`vcsDriversExtensionPoint`, `cloudDriversExtensionPoint`, `communicationDriversExtensionPoint`, `complianceDriversExtensionPoint`, `incidentManagementDriversExtensionPoint`, `kubernetesDiagnosticsDriversExtensionPoint`, `observabilityDriversExtensionPoint`, `projectManagementDriversExtensionPoint`, `qualityScorecardsExtensionPoint`).

Change:

```ts
// Workflow registration (renamed method)
export interface WorkflowRunnerExtensionPoint {
  registerWorkflow(workflow: WorkflowDefinition): void;   // was registerRunner(WorkflowRunner)
}
export const workflowRunnerExtensionPoint =
  createExtensionPoint<WorkflowRunnerExtensionPoint>({ id: 'plugin-ai.workflow-runner' });

// REMOVE: modelExtensionPoint (replaced by per-category points below)

// Per-category model registration points (new)
export const chatModelsExtensionPoint = createExtensionPoint<{ addChatModel(d: ChatModelDefinition): void }>({ id: 'plugin-ai.models.chat' });
export const embeddingsExtensionPoint = createExtensionPoint<{ addEmbeddings(d: EmbeddingsDefinition): void }>({ id: 'plugin-ai.models.embeddings' });
export const transcriptionExtensionPoint = createExtensionPoint<{ addTranscription(d: TranscriptionDefinition): void }>({ id: 'plugin-ai.models.transcription' });
export const rerankingExtensionPoint = createExtensionPoint<{ addReranking(d: RerankingDefinition): void }>({ id: 'plugin-ai.models.reranking' });
export const guardrailExtensionPoint = createExtensionPoint<{ addGuardrail(d: GuardrailDefinition): void }>({ id: 'plugin-ai.models.guardrail' });

// Vector store provider point (new — replaces LLM modules hard-coding createPgVectorStore)
export const vectorStoreExtensionPoint = createExtensionPoint<{ addVectorStore(d: VectorStoreDefinition): void }>({ id: 'plugin-ai.storage.vector' });

// Runtime stores: add optional StateSerializer
export interface RuntimeStoreExtensionPoint {
  setSessionStore(s: SessionStore): void;
  setCheckpointStore(s: CheckpointStore): void;
  setRunStore(s: RunStore): void;
  setArtifactSink(s: ArtifactSink): void;
  setAuditLogSink(s: AuditLogSink): void;
  setUsageSink?(s: UsageSink): void;                 // NEW
  setStateSerializer?(s: StateSerializer): void;     // NEW (KMS seam)
}
```

`VectorStoreDefinition` lives in `stores/usage.ts` or `@types/vector.ts` — `{ id: string; store: VectorStore }`.

## Step 11 — `testUtils/` — shared test harness (new directory)

- `fakeModel.ts`: `FakeChatModel` — scripted responses, schema-valid + intentionally-invalid modes, `usage_metadata` emission. Extends `BaseChatModel`.
- `nodeContext.ts`: `createTestNodeContext({ tools, model, artifacts, clock })` — a `NodeExecutionContext` with a controllable fake clock, an in-memory tool registry stub honoring allow-lists, and artifact capture.
- `runWorkflow.ts`: `runWorkflow(def, input, ctx)` — drives a `WorkflowDefinition` through a minimal in-test engine (linear+branch+parallel+interrupt) and returns the ordered `AgentEvent[]` for assertion.
- `contractTests.ts`: `defineDriverContractTests<TDriver>({ makeDriver, category })` — reusable Vitest suite asserting every read op returns contract-shaped results, absent capability degrades to a typed limitation (never throws / never silent `[]`), `providerId` non-empty string, no provider types leak into contract I/O.

## Step 12 — `catalog/` (unchanged)

Keep `catalog/` as-is (`CatalogEntityResolver`, `mapping.ts`, `types.ts`). Add `findUserByEmail(email)` (or generic `findByField`) to `CatalogEntityResolver` and `memberOf` traversal via `getRelations` — additive methods for search-ai-archeology. Update `catalog/types.ts` + `mapping.ts` accordingly, extend `mapping.test.ts`.

## Step 13 — `index.ts` barrel

```ts
export * from './@types';
export * from './catalog';
export * from './events';
export * from './extensions';
export * from './models';
export * from './redaction';
export * from './stores';
export * from './workflow';
export * as testUtils from './testUtils';
```

## Step 14 — Validation

- `node .yarn/sdks/typescript/bin/tsc --noEmit -p plugins/backend/plugin-ai-core-node` — clean.
- `yarn lint plugins/backend/plugin-ai-core-node`.
- Run package tests: new `workflow/__tests__`, `testUtils/__tests__`, updated `catalog/__tests__/mapping.test.ts`.
- Confirm no remaining references to `Orchestrator`, `BaseGraphRunner`, `crew`, `BaseLLM` in `src/`.

## Done criteria for this package

- Public API contains: workflow DSL, `AgentEvent` v2, versioned `CheckpointStore` + `StateSerializer`, `UsageSink`, `RedactionPolicy`, per-category model contracts, widened provider IDs, per-category extension points, shared `testUtils`.
- Zero references to orchestrators, crew, `BaseLLM`, or the old blob `CheckpointStore`.
- All pure contracts — no runtime execution logic in this package.


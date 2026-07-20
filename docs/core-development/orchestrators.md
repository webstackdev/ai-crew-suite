---
layout: default
title: Orchestrators & Agents
parent: Core Development
---

## Orchestrators & Agents

{: .no_toc }

The orchestrator layer turns an `AgentDefinition` and an `AgentRunInput` into a stream of normalized `AgentEvent` records. It is deliberately provider-neutral: model selection, tool access, memory, persistence, retry policy, token accounting, approvals, and audit sinks are supplied through `RunContext` by the core backend runtime.

### Runtime Ownership

`AgentRuntime` owns cross-cutting execution concerns. Orchestrators should focus on the shape of the agent workflow, not run persistence policy.

Runtime responsibilities include:

- Resolving the requested agent and orchestrator.
- Creating and updating run records.
- Persisting run steps for replay.
- Applying retry and backoff policy.
- Applying token budget limits.
- Redacting sensitive payload keys before audit persistence.
- Recording write-tool approvals and audit events.
- Delegating resume handling to orchestrators that support it.

Orchestrator responsibilities include:

- Emitting lifecycle `step` events around meaningful workflow nodes.
- Calling tools through `ToolRegistry` and `ToolContext`.
- Calling models through `LlmService`.
- Streaming `token` events as model output arrives.
- Emitting `usage`, `artifact`, `approval_request`, `done`, or `error` events as appropriate.

### Agent Definitions

Agents are declarative runtime profiles. They can be contributed by modules through `agentExtensionPoint` or derived from `ai.agents` config during service assembly.

```typescript
type AgentDefinition = {
  id: string;
  modelRef: string;
  systemPrompt: string;
  toolIds: string[];
  orchestrator?: 'single-shot' | 'langgraph' | 'crew';
  memory?: 'none' | 'session';
  crew?: {
    roles: {
      id: string;
      systemPrompt: string;
      modelRef?: string;
      toolIds?: string[];
    }[];
  };
};
```

The backend validates every model and tool reference after all modules and config-defined agents are resolved. Unknown model IDs, unknown tool IDs, empty crew role lists, and invalid crew role references fail startup instead of producing a partially wired runtime.

### Built-In Agents

The backend creates built-in agents only when a module or config entry has not already registered the same ID.

| Agent ID                 | Orchestrator  | Purpose                                                                                  |
| ------------------------ | ------------- | ---------------------------------------------------------------------------------------- |
| `service-contextualizer` | `single-shot` | Default contextual answer agent using the configured default model and registered tools. |
| `doc-janitor-crew`       | `crew`        | Multi-role documentation workflow with researcher, writer, and reviewer roles.           |

Config-defined agents are merged after built-ins. Runtime-registered agents remain authoritative, so a module can intentionally replace a built-in profile by registering the same ID before backend service assembly.

### Orchestrator Types

#### Single-Shot

`SingleShotOrchestrator` performs a linear RAG cycle:

1. Emit `step` enter for `single-shot`.
2. Invoke `knowledge.retrieve` with the query, source, and optional entity filter.
3. Pass retrieved documents to `LlmService.query` with the selected model and system prompt.
4. Stream model output as `token` events.
5. Emit `usage`, `step` exit, and `done`.

Use this orchestrator for direct question-answering, lightweight contextualization, and workflows where one model call should produce the final result.

#### LangGraph

`LangGraphOrchestrator` is the session-oriented workflow path. It is the right place to extend graph-like state progression, resumable node traversal, or memory-aware execution. It should continue to emit the same normalized event types as other orchestrators so the controller and frontend do not need graph-specific handling.

Use this orchestrator when a workflow needs persisted session context or a more explicit state machine than the single-shot path.

#### Crew

`CrewOrchestrator` executes ordered crew roles from an agent's `crew.roles` definition. Each role can override the parent agent's model and tools. The orchestrator aggregates role output into a coordinated multi-step answer and emits lifecycle/tool/model events for each role.

Use this orchestrator when the quality of the result depends on role separation, review passes, or model specialization across steps.

### Event Stream Contract

Every orchestrator emits `AgentEvent` values. The controller forwards these over server-sent events and the runtime persists them through `RunStore` when available.

| Event type         | Meaning                                      |
| ------------------ | -------------------------------------------- |
| `step`             | Enter or exit a named workflow node.         |
| `token`            | Streamed text from a model.                  |
| `tool_call`        | A tool is about to be invoked.               |
| `tool_result`      | A tool completed or failed.                  |
| `usage`            | Token accounting for the run.                |
| `approval_request` | The run is paused for a human decision.      |
| `artifact`         | The run produced a durable output reference. |
| `done`             | The run completed successfully.              |
| `error`            | The run failed without further recovery.     |

Keep event payloads small, serializable, and stable. If a tool returns a large object, summarize it in `tool_result.summary` and store the full artifact through `ArtifactSink` when it needs to survive beyond the stream.

### Tool Execution

The standard retrieval tool is `knowledge.retrieve`. It is registered by the core backend from the first module-provided retrieval pipeline and calls `retrieveAugmentationContext(query, source, entityFilter)`.

Provider modules may also register their own tool IDs, such as `aws.bedrock.retrieval` or `openai.embeddings.retrieval`, but agents should usually depend on `knowledge.retrieve` unless they intentionally need provider-specific behavior.

Tools declare an `effect` of `read` or `write`. Write-capable tools should emit approval events or rely on runtime approval handling before performing external mutations. Sensitive fields such as authorization headers, API keys, secrets, passwords, cookies, and tokens are redacted before audit logging.

### Persistence and Resume

`PgAgentRuntimeStore` implements the core persistence contracts used by `AgentRuntime`:

- `SessionStore` for memory-backed conversation history.
- `CheckpointStore` for resumable state.
- `RunStore` for run records, steps, statuses, idempotency keys, and approvals.
- `ArtifactSink` for durable run outputs.
- `AuditLogSink` for write actions and approval decisions.

Only orchestrators that implement `resume` can continue a paused run. The runtime updates approval state first, records approved write actions in the audit log, and then delegates to the orchestrator's resume implementation.

### Change Checklist

When modifying orchestrator behavior:

- Add or update focused tests for the touched orchestrator and `AgentRuntime` behavior.
- Keep provider-specific assumptions out of orchestrators; use `RunContext` and registered tools/models.
- Preserve the normalized `AgentEvent` contract unless every stream consumer is updated.
- Let unexpected model stream failures propagate to `AgentRuntime` so retry policy can apply.
- Update [Ingestion Pipelines](ingestion-pipelines.md) if retrieval tool arguments or semantics change.
- Update [LLM Providers](llm-providers.md) if model selection or model registry rules change.

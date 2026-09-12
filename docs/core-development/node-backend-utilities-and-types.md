# Developer Guide: Kernel Node Test Utilities

This documentation covers the core testing utility files located within the kernel node-library plugin of this Spotify Backstage monorepo (``@ai-crew-suite/plugin-kernel-node``). These utilities ensure that agentic workflow plugins adhere to systemic contract invariants, mock required interfaces safely, and remain decoupled from internal provider implementations.

## 1. Driver Invariant Contract Testing

**File Path:** `plugins/kernel/node/src/testUtils/contractTests.ts`

This utility provides an automated, reusable test suite scaffold (`defineDriverContractTests`) designed to enforce structural safety invariants on all custom capability drivers (e.g., Vector Stores, Caches, or LLM providers) developed across your 18 agentic plugins.

### Core Safety Invariants Enforced

- **Identity Integrity:** Verifies that the driver provides a valid, traceable, non-empty `providerId` string.
- **Graceful Degradation:** Asserts that all operational paths return defined payloads or structured limitations rather than unhandled runtime crashes.
- **Leak Prevention:** Ensures internal provider-specific database or network client classes (e.g., native Postgres clients, internal raw buffers) do not leak into the standard communication I/O map.

### API Reference

#### `DriverContractTestOptions<TDriver>`

Interface for the configurations required to run the automated contract suite.

| Property | Type | Description |
| --- | --- | --- |
| `category` | `string` | The functional capability group being tested (e.g., `'VectorStore'`). |
| `makeDriver` | `() => TDriver | Promise<TDriver>` | Factory function that provisions a clean, fully configured driver instance. |
| `exerciseOps` | `(driver: TDriver) => Promise<unknown[]>` | Execution hook that runs standard actions and returns an array of operational results. |

#### `defineDriverContractTests(options)`

Generates and registers standard Backstage/Jest behavior blocks (`describe`/`it`) for the driver execution path.

```typescript
export function defineDriverContractTests<TDriver extends { providerId: string }>(
  options: DriverContractTestOptions<TDriver>
): void
```

#### Usage Example

```typescript
import { defineDriverContractTests } from '@backstage/plugin-kernel-node/testUtils';
import { PostgresVectorStore } from '../drivers/PostgresVectorStore';

defineDriverContractTests({
  category: 'VectorStore',
  makeDriver: () => new PostgresVectorStore({ connectionString: 'mock://...' }),
  exerciseOps: async (driver) => {
    const searchResult = await driver.search('cluster-agent-logs', { limit: 1 });
    return [searchResult];
  }
});
```

## 2. Scriptable Mock Chat Model Simulation

**File Path:** `plugins/kernel/node/src/testUtils/fakeModel.ts`

This utility provides a highly deterministic, scriptable mock model framework (`FakeChatModel`) extending **LangChain’s** core `BaseChatModel`. It isolates your Backstage agentic workflows from live LLM vendor environments while permitting complex assertions on token usage, conversational tracking, and response replays.

### Key Features

- **Sequential Replay Scripting:** Returns predefined response payloads in order of configuration across both synchronous operations (`.invoke()`) and async streaming contexts (`.stream()`).
- **Token Usage Metrics Mapping:** Injects mock `usage_metadata` blocks directly into message payloads to test billing, rate-limiting, and cost-attribution hooks.
- **Call Audit Inspection Vector:** Exposes a historical call log (`.calls`) tracking all incoming messages and configuration options received during a test life cycle.

### API Reference

#### `FakeModelScript` & `FakeModelCallTrace`

Structural types managing step sequences and outbound invocation inspection histories.

```typescript
export type FakeModelScript = {
  text: string;
  usage?: { input: number; output: number; total: number };
};

export type FakeModelCallTrace = {
  messages: BaseMessage[];
  options: Record<string, any>;
};
```

#### `FakeChatModel`

Extends LangChain `BaseChatModel` with programmatic mock insertion.

| Property / Method | Signature | Description |
| --- | --- | --- |
| `constructor()` | `(steps?: FakeModelScript[], fields?: BaseChatModelParams)` | Instantiates the model with an optional base array of text script items. |
| `queue()` | `(step: FakeModelScript) => void` | Appends a new mock response configuration payload onto the end of the runtime queue. |
| `calls` | `FakeModelCallTrace[]` | Read-only inspection array capturing all inputs passed to the model during execution. |

#### Usage Example

```typescript
import { HumanMessage } from '@langchain/core/messages';
import { FakeChatModel } from '@backstage/plugin-kernel-node/testUtils';

// 1. Initialize with predefined steps
const mockModel = new FakeChatModel([
  { text: 'Hello! I am your agent.', usage: { input: 10, output: 5, total: 15 } },
  { text: 'I am executing your task now.', usage: { input: 15, output: 10, total: 25 } }
]);

// 2. Queue additional responses dynamically if needed
mockModel.queue({ text: 'Task completed successfully.' });

// 3. Execute step 1 via invoke
const response1 = await mockModel.invoke([new HumanMessage('Hi')]);
console.log(response1.content); // Output: "Hello! I am your agent."

// 4. Inspect calls array for testing validations
expect(mockModel.calls.length).toBe(1);
expect(mockModel.calls[0].messages[0].content).toBe('Hi');
```

## 3. Sandboxed Execution Context Provisioning

**File Path:** `plugins/kernel/node/src/testUtils/nodeContext.ts`

This utility provides a controlled, fully deterministic execution container (`createTestNodeContext`) that wraps Backstage’s `NodeExecutionContext`. It isolates sensitive runtime operations—such as third-party tool execution, time calculations, telemetry collection, and pipeline cancellation tracking—into a predictable sandbox suitable for unit testing.

### Key Features

- **Tool Restrictions & Access Controls:** Implements an explicit execution allowlist (`allowedToolIds`) and automatically throws exceptions if an unlisted or unregistered tool is invoked.
- **Temporal Anchoring:** Pinpoints the internal runtime clock (`.now()`) to a static, frozen timestamp to ensure date-based logic remains stable across test runs regardless of the runner's real-world time.
- **Telemetry Extraction Matrix:** Intercepts outgoing pipeline artifacts via an isolated collection array (`capturedArtifacts`), eliminating the need to mock complex downstream logging infrastructures.
- **Native Abort Tracking:** Links directly to an `AbortSignal` token to model timeouts and host-initiated worker cancellations under standard test conditions.

### API Reference

#### `TestNodeContextOptions`

Configuration overrides to provision the sandboxed container.

| Property | Type | Description |
| --- | --- | --- |
| `toolRegistry` | `ToolRegistry`  | *(Optional)* Registry instances containing verifiable tool definitions. |
| `allowedToolIds` | `string[]` | *(Optional)* Strict list of string identifiers authorized to run. |
| `model` | `ModelExecutor` | *(Optional)* The LLM execution bridge (typically a `FakeChatModel`). |
| `now` | `Date` | *(Optional)* Custom time anchor. Defaults to `2026-01-01T00:00:00.000Z`. |
| `logger` | `LoggerService` | *(Optional)* Backstage logger adapter. Suppresses logs by default. |
| `signal` | `AbortSignal` | *(Optional)* An external cancellation token to trigger abort paths. |

#### `TestNodeExecutionContext`

An extended context variant containing the snapshot trace block.

```typescript
export type TestNodeExecutionContext = NodeExecutionContext & {
  readonly capturedArtifacts: Array<{ kind: string; payload: unknown }>;
};
```

#### Usage Example

```typescript
import { createTestNodeContext } from '@backstage/plugin-kernel-node/testUtils';

// 1. Provision context with explicit limits and a frozen timeline
const context = createTestNodeContext({
  allowedToolIds: ['spotify-playlist-creator'],
  now: new Date('2026-09-12T00:00:00.000Z')
});

// 2. Execute workflows or nodes using the context
await context.emitArtifact('agent_decision_tree', { rule: 'fallback_triggered' });

// 3. Perform assertions on captured metrics
expect(context.capturedArtifacts.length).toBe(1);
expect(context.capturedArtifacts[0].kind).toBe('agent_decision_tree');
expect(context.now().toISOString()).toBe('2026-09-12T00:00:00.000Z');
```

## 4. Modular Workflow Test Runner Engine

**File Path:** `plugins/kernel/node/src/testUtils/runWorkflow.ts`

This utility features an isolated, lightweight state engine scaffold (`runWorkflow`) designed to execute complete `WorkflowDefinition` graphs under test frameworks. It provides standard lifecycle tracking, bounds checks, schema validation, and interrupt interceptions while maintaining a highly modular internal code structure.

### Key Features

- **Infinite Loop Safeguards:** Tracks execution sequences through an iteration counters guard (`maxIterations`), actively breaking cycles and throwing explicit runtime errors before exhausting the test runner environment.
- **Schema Validation Enforcement:** Leverages internal Zod schematics (`def.inputSchema` and `def.state.schema`) to apply input validation and force state patches through structural verification steps.
- **Declarative Interrupt Gates:** Intercepts execution trajectories when a node hits an evaluation marker (`approvalRequest`), emitting synthetic human-in-the-loop lifecycle vectors seamlessly.
- **Ordered Event Logs:** Produces a comprehensive sequence trace (`AgentEvent[]`) mapping every enter, exit, and lifecycle transition point encountered during execution.

### API Reference

#### `WorkflowRunResult<TState>`

The response payload containing execution analytics.

```typescript
export interface WorkflowRunResult<TState> {
  events: AgentEvent[];
  finalState: TState;
}
```

#### `runWorkflow(def, rawInput, ctx, maxIterations)`

Launches the execution supervisor against a target workflow specification block.

```typescript
export async function runWorkflow<TState, TInput>(
  def: WorkflowDefinition<TState, TInput>,
  rawInput: TInput,
  ctx: NodeExecutionContext,
  maxIterations = 100,
): Promise<WorkflowRunResult<TState>>
```

#### Usage Example

```typescript
import { runWorkflow } from '@backstage/plugin-kernel-node/testUtils';
import { createTestNodeContext } from './nodeContext';
import { myAgenticWorkflowDef } from '../workflows/myAgenticWorkflowDef';

describe('Agentic Workflow Execution', () => {
  it('should successfully complete linear node transitions', async () => {
    const context = createTestNodeContext();
    const inputPayload = { targetUserId: 'user-123', criteria: 'active' };

    // Run the workflow definition in the test harness
    const { events, finalState } = await runWorkflow(
      myAgenticWorkflowDef,
      inputPayload,
      context,
      25 // Maximum allowed steps before breaking
    );

    // Verify lifecycle steps match operational goals
    expect(events.some(e => e.type === 'done')).toBe(true);
    expect(finalState.isProcessingComplete).toBe(true);
  });
});
```

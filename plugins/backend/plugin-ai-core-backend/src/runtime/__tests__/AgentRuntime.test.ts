/*
 * Copyright 2026 Webstack Builders, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { describe, expect, it, jest } from '@jest/globals';
import type {
  AgentDefinition,
  AgentEvent,
  AgentRunInput,
  ApprovalDecision,
  Orchestrator,
  RunContext,
  RunRecord,
  RunStore,
  Tool,
  ToolRegistry,
} from '@webstackbuilders/plugin-ai-core-node';
import { AgentRuntime } from '../AgentRuntime';

type RuntimeContext = Parameters<AgentRuntime['run']>[1];

const agent: AgentDefinition = {
  id: 'agent-a',
  modelRef: 'model-a',
  systemPrompt: 'Use the catalog context',
  toolIds: ['catalog.write'],
  orchestrator: 'single-shot',
  memory: 'session',
};

const runInput: AgentRunInput = {
  runId: 'run-1',
  agentId: 'agent-a',
  idempotencyKey: 'idempotency-1',
  trigger: 'manual',
  input: {
    query: 'Who owns this service?',
    source: 'catalog',
    sessionId: 'session-1',
  },
};

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(),
});

const createRunStore = (run?: RunRecord): RunStore => ({
  createRun: jest.fn(async () => undefined),
  getRun: jest.fn(async () => run),
  findRunByIdempotencyKey: jest.fn(async () => undefined),
  updateRunStatus: jest.fn(async () => undefined),
  appendRunStep: jest.fn(async () => undefined),
  listRunSteps: jest.fn(async () => []),
  createApproval: jest.fn(async () => undefined),
  getPendingApproval: jest.fn(async () => undefined),
  decideApproval: jest.fn(async () => undefined),
});

const createToolRegistry = (): ToolRegistry => ({
  register: jest.fn(),
  get: jest.fn((id: string): Tool | undefined => {
    if (id !== 'catalog.write') {
      return undefined;
    }

    return {
      id,
      effect: 'write',
      invoke: jest.fn(async () => ({ ok: true })),
    };
  }),
  list: jest.fn(() => []),
});

const createContext = (overrides: Partial<RuntimeContext> = {}): RuntimeContext => ({
  logger: createLogger() as any,
  toolRegistry: createToolRegistry(),
  model: {} as RunContext['model'],
  identity: 'user:default/alice',
  runStore: createRunStore(),
  artifactSink: {
    record: jest.fn(async (_artifact: unknown) => undefined),
  },
  auditLogSink: {
    recordWriteAction: jest.fn(async (_entry: unknown) => undefined),
  },
  ...overrides,
});

const createRuntime = (orchestrator: Orchestrator, agents = [agent]) =>
  new AgentRuntime(
    new Map(agents.map(agentDefinition => [agentDefinition.id, agentDefinition])),
    new Map([['single-shot', orchestrator]]),
  );

const createOrchestrator = (events: AgentEvent[]): Orchestrator => ({
  run: jest.fn(async function* runOrchestrator() {
    for (const event of events) {
      yield event;
    }
  }) as Orchestrator['run'],
});

const createResumableOrchestrator = (
  events: AgentEvent[],
): Orchestrator => ({
  run: jest.fn(async function* runOrchestrator() {}) as Orchestrator['run'],
  resume: jest.fn(async function* resumeOrchestrator() {
    for (const event of events) {
      yield event;
    }
  }) as NonNullable<Orchestrator['resume']>,
});

const collectEvents = async (events: AsyncIterable<AgentEvent>) => {
  const collected: AgentEvent[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
};

describe('AgentRuntime', () => {
  it('logs and yields an error when a run references an unknown agent', async () => {
    const logger = createLogger();
    const runStore = createRunStore();
    const runtime = createRuntime(createOrchestrator([]), []);

    const events = await collectEvents(
      runtime.run(runInput, createContext({ logger: logger as any, runStore })),
    );

    expect(events).toEqual([
      {
        type: 'error',
        data: { runId: 'run-1', message: "Unknown agent 'agent-a'" },
      },
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      "Run 'run-1' requested unknown agent 'agent-a'",
    );
    expect(runStore.createRun).not.toHaveBeenCalled();
  });

  it('persists run events and records write-tool, approval, and artifact side effects', async () => {
    const events: AgentEvent[] = [
      {
        type: 'tool_call',
        data: {
          runId: 'run-1',
          tool: 'catalog.write',
          args: { password: 'secret', nested: { apiKey: 'token' } },
        },
      },
      { type: 'usage', data: { runId: 'run-1', input: 2, output: 3, total: 5 } },
      {
        type: 'approval_request',
        data: {
          runId: 'run-1',
          approvalId: 'approval-1',
          reason: 'Needs write access',
          effect: 'write',
        },
      },
      {
        type: 'artifact',
        data: { runId: 'run-1', kind: 'doc', ref: 'summary', url: 'memory://summary' },
      },
      { type: 'done', data: { runId: 'run-1', sessionId: 'session-1' } },
    ];
    const orchestrator = createOrchestrator(events);
    const runtime = createRuntime(orchestrator);
    const runStore = createRunStore();
    const artifactSink = { record: jest.fn(async (_artifact: unknown) => undefined) };
    const auditLogSink = {
      recordWriteAction: jest.fn(async (_entry: unknown) => undefined),
    };

    const collected = await collectEvents(
      runtime.run(
        runInput,
        createContext({ runStore, artifactSink, auditLogSink }),
      ),
    );

    expect(collected).toEqual(events);
    expect(runStore.createRun).toHaveBeenCalledWith({
      id: 'run-1',
      agentId: 'agent-a',
      sessionId: 'session-1',
      status: 'running',
      trigger: 'manual',
      idempotencyKey: 'idempotency-1',
    });
    expect(orchestrator.run).toHaveBeenCalledWith(
      runInput,
      expect.objectContaining({
        systemPrompt: 'Use the catalog context',
        memory: 'session',
      }),
    );
    expect(runStore.appendRunStep).toHaveBeenNthCalledWith(
      1,
      'run-1',
      1,
      'tool_call',
      {
        runId: 'run-1',
        tool: 'catalog.write',
        args: { password: '[REDACTED]', nested: { apiKey: '[REDACTED]' } },
      },
    );
    expect(auditLogSink.recordWriteAction).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        agentId: 'agent-a',
        action: 'write_tool_call',
        toolId: 'catalog.write',
        payload: { password: '[REDACTED]', nested: { apiKey: '[REDACTED]' } },
        actor: 'user:default/alice',
      }),
    );
    expect(runStore.createApproval).toHaveBeenCalledWith({
      id: 'approval-1',
      runId: 'run-1',
      reason: 'Needs write access',
      effect: 'write',
    });
    expect(artifactSink.record).toHaveBeenCalledWith({
      id: 'run-1:4',
      runId: 'run-1',
      kind: 'doc',
      ref: 'summary',
      url: 'memory://summary',
    });
    expect(runStore.updateRunStatus).toHaveBeenCalledWith('run-1', 'paused');
    expect(runStore.updateRunStatus).toHaveBeenCalledWith('run-1', 'done');
  });

  it('stops a run and logs when token budget is exceeded', async () => {
    const logger = createLogger();
    const runStore = createRunStore();
    const runtime = createRuntime(
      createOrchestrator([
        { type: 'usage', data: { runId: 'run-1', input: 4, output: 7, total: 11 } },
        { type: 'done', data: { runId: 'run-1' } },
      ]),
    );

    const events = await collectEvents(
      runtime.run(
        runInput,
        createContext({
          logger: logger as any,
          runStore,
          hardening: { maxTotalTokens: 10 },
        }),
      ),
    );

    expect(events).toEqual([
      { type: 'usage', data: { runId: 'run-1', input: 4, output: 7, total: 11 } },
      {
        type: 'error',
        data: { runId: 'run-1', message: 'Token budget exceeded (11/10)' },
      },
    ]);
    expect(logger.warn).toHaveBeenCalledWith("Run 'run-1' exceeded token budget (11/10)");
    expect(runStore.appendRunStep).toHaveBeenNthCalledWith(
      2,
      'run-1',
      2,
      'error',
      { runId: 'run-1', message: 'Token budget exceeded (11/10)' },
    );
    expect(runStore.updateRunStatus).toHaveBeenCalledWith('run-1', 'error');
  });

  it('logs and persists an error when the orchestrator throws', async () => {
    const logger = createLogger();
    const runStore = createRunStore();
    const orchestrator: Orchestrator = {
      run: jest.fn(async function* throwFromRun() {
        throw new Error('model unavailable');
      }) as Orchestrator['run'],
    };
    const runtime = createRuntime(orchestrator);

    const events = await collectEvents(
      runtime.run(runInput, createContext({ logger: logger as any, runStore })),
    );

    expect(events).toEqual([
      { type: 'error', data: { runId: 'run-1', message: 'model unavailable' } },
    ]);
    expect(logger.error).toHaveBeenCalledWith("Run 'run-1' failed: model unavailable");
    expect(runStore.appendRunStep).toHaveBeenCalledWith(
      'run-1',
      1,
      'error',
      { runId: 'run-1', message: 'model unavailable' },
    );
    expect(runStore.updateRunStatus).toHaveBeenCalledWith('run-1', 'error');
  });

  it('logs and yields an error when resuming an unknown run', async () => {
    const logger = createLogger();
    const runtime = createRuntime(createResumableOrchestrator([]));

    const events = await collectEvents(
      runtime.resume(
        'missing-run',
        { status: 'approved' },
        createContext({ logger: logger as any, runStore: createRunStore() }),
      ),
    );

    expect(events).toEqual([
      { type: 'error', data: { runId: 'missing-run', message: "Unknown run 'missing-run'" } },
    ]);
    expect(logger.warn).toHaveBeenCalledWith("Resume requested for unknown run 'missing-run'");
  });

  it('resumes approved runs and records approval plus artifact audit side effects', async () => {
    const decision: ApprovalDecision = {
      status: 'approved',
      note: 'Looks safe',
      decidedBy: 'user:default/reviewer',
    };
    const runStore = createRunStore({
      id: 'run-1',
      agentId: 'agent-a',
      status: 'paused',
    });
    const artifactSink = { record: jest.fn(async (_artifact: unknown) => undefined) };
    const auditLogSink = {
      recordWriteAction: jest.fn(async (_entry: unknown) => undefined),
    };
    const events: AgentEvent[] = [
      {
        type: 'artifact',
        data: { runId: 'run-1', kind: 'doc', ref: 'approved', url: 'memory://approved' },
      },
      { type: 'done', data: { runId: 'run-1' } },
    ];
    const orchestrator = createResumableOrchestrator(events);
    const runtime = createRuntime(orchestrator);

    const collected = await collectEvents(
      runtime.resume(
        'run-1',
        decision,
        createContext({ runStore, artifactSink, auditLogSink }),
      ),
    );

    expect(collected).toEqual(events);
    expect(runStore.decideApproval).toHaveBeenCalledWith('run-1', decision);
    expect(runStore.updateRunStatus).toHaveBeenCalledWith('run-1', 'running');
    expect(auditLogSink.recordWriteAction).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        agentId: 'agent-a',
        action: 'approval_approved',
        payload: decision,
        actor: 'user:default/reviewer',
      }),
    );
    expect(runStore.appendRunStep).toHaveBeenNthCalledWith(
      1,
      'run-1',
      1000001,
      'artifact',
      { runId: 'run-1', kind: 'doc', ref: 'approved', url: 'memory://approved' },
    );
    expect(artifactSink.record).toHaveBeenCalledWith({
      id: 'run-1:1000001',
      runId: 'run-1',
      kind: 'doc',
      ref: 'approved',
      url: 'memory://approved',
    });
    expect(auditLogSink.recordWriteAction).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        agentId: 'agent-a',
        action: 'artifact_recorded',
        payload: { runId: 'run-1', kind: 'doc', ref: 'approved', url: 'memory://approved' },
        actor: 'user:default/reviewer',
      }),
    );
    expect(runStore.updateRunStatus).toHaveBeenCalledWith('run-1', 'done');
  });
});
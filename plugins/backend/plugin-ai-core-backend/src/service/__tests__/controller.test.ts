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
import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type {
  AgentDefinition,
  AgentEvent,
  ApprovalDecision,
  AugmentationIndexer,
  RetrievalPipeline,
  RunRecord,
  RunStepRecord,
  RunStore,
  SessionStore,
  ToolRegistry,
} from '@webstackbuilders/plugin-ai-core-node';
import { AiCoreController } from '../controller';

type MockResponse = EventEmitter & {
  statusCode?: number;
  body?: unknown;
  chunks: string[];
  headers?: Record<string, string>;
};

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(),
});

const createRequest = ({
  params = {},
  body = {},
  query = {},
  headers = {},
}: {
  params?: Record<string, string>;
  body?: any;
  query?: Record<string, unknown>;
  headers?: Record<string, string | undefined>;
} = {}) => {
  const req = new EventEmitter() as any;
  req.params = params;
  req.body = body;
  req.query = query;
  req.header = jest.fn((name: string) => headers[name.toLowerCase()]);
  return req;
};

const createResponse = () => {
  const res = new EventEmitter() as MockResponse & {
    status: jest.Mock;
    send: jest.Mock;
    json: jest.Mock;
    writeHead: jest.Mock;
    write: jest.Mock;
    end: jest.Mock;
    flush: jest.Mock;
  };
  res.chunks = [];
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.send = jest.fn((body?: unknown) => {
    res.body = body;
    return res;
  });
  res.json = jest.fn((body?: unknown) => {
    res.body = body;
    return res;
  });
  res.writeHead = jest.fn((code: number, headers: Record<string, string>) => {
    res.statusCode = code;
    res.headers = headers;
    return res;
  });
  res.write = jest.fn((chunk: string) => {
    res.chunks.push(chunk);
    return true;
  });
  res.end = jest.fn(() => {
    res.emit('close');
    return res;
  });
  res.flush = jest.fn();
  return res as any;
};

async function* events(eventsToYield: AgentEvent[] = []): AsyncIterable<AgentEvent> {
  for (const event of eventsToYield) {
    yield event;
  }
}

async function* throwingEvents(message: string): AsyncIterable<AgentEvent> {
  throw new Error(message);
}

const createAgent = (overrides: Partial<AgentDefinition> = {}): AgentDefinition => ({
  id: 'agent-a',
  modelRef: 'model-a',
  systemPrompt: 'System prompt',
  toolIds: [],
  orchestrator: 'single-shot',
  memory: 'none',
  ...overrides,
});

const createRun = (overrides: Partial<RunRecord> = {}): RunRecord => ({
  id: 'run-a',
  agentId: 'agent-a',
  status: 'running',
  ...overrides,
});

const createRunStore = (overrides: Partial<RunStore> = {}): RunStore => ({
  createRun: jest.fn(async () => undefined),
  getRun: jest.fn(async () => undefined),
  findRunByIdempotencyKey: jest.fn(async () => undefined),
  updateRunStatus: jest.fn(async () => undefined),
  appendRunStep: jest.fn(async () => undefined),
  listRunSteps: jest.fn(async () => []),
  createApproval: jest.fn(async () => undefined),
  getPendingApproval: jest.fn(async () => undefined),
  decideApproval: jest.fn(async () => undefined),
  ...overrides,
});

const createController = ({
  logger = createLogger(),
  runtime = {
    run: jest.fn(() => events([{ type: 'done', data: { runId: 'run-a' } }])),
    resume: jest.fn(() => events([{ type: 'done', data: { runId: 'run-a' } }])),
  },
  augmentationIndexer = {
    vectorStore: {},
    createEmbeddings: jest.fn(async () => 3),
    deleteEmbeddings: jest.fn(async () => undefined),
  } as unknown as AugmentationIndexer,
  retrievalPipeline = {
    retrieveAugmentationContext: jest.fn(async () => [
      { content: 'doc', metadata: { source: 'catalog' } },
    ]),
  } as RetrievalPipeline,
  models = new Map<string, any>([['model-a', { stream: jest.fn() }]]),
  agents = new Map<string, AgentDefinition>([['agent-a', createAgent()]]),
  runStore = createRunStore(),
  sessionStore,
  triggers = [],
  hardening = {},
}: {
  logger?: ReturnType<typeof createLogger>;
  runtime?: any;
  augmentationIndexer?: AugmentationIndexer;
  retrievalPipeline?: RetrievalPipeline;
  models?: Map<string, any>;
  agents?: Map<string, AgentDefinition>;
  runStore?: RunStore;
  sessionStore?: SessionStore;
  triggers?: { id: string; source?: string; agentId?: string }[];
  hardening?: {
    timeoutMs?: number;
    maxRetries?: number;
    retryBackoffMs?: number;
    maxTotalTokens?: number;
    rateLimitPerMinute?: number;
  };
} = {}) => {
  const controller = new AiCoreController(
    logger as any,
    runtime,
    {} as ToolRegistry,
    augmentationIndexer,
    models,
    agents,
    'agent-a',
    retrievalPipeline,
    sessionStore,
    undefined,
    runStore,
    undefined,
    undefined,
    triggers,
    hardening,
  );

  return { controller, logger, runtime, augmentationIndexer, retrievalPipeline, runStore };
};

describe('AiCoreController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists registered agents without exposing model or prompt details', async () => {
    const { controller } = createController({
      agents: new Map([
        ['agent-a', createAgent({ toolIds: ['catalog.read'] })],
        ['agent-b', createAgent({ id: 'agent-b', orchestrator: 'crew', memory: 'session' })],
      ]),
    });
    const res = createResponse();

    await controller.listAgents(createRequest(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      agents: [
        {
          id: 'agent-a',
          orchestrator: 'single-shot',
          memory: 'none',
          tools: ['catalog.read'],
        },
        {
          id: 'agent-b',
          orchestrator: 'crew',
          memory: 'session',
          tools: [],
        },
      ],
    });
  });

  it('creates, retrieves, and deletes embeddings with useful logging', async () => {
    const { controller, logger, augmentationIndexer, retrievalPipeline } = createController();
    const filter = { kind: 'Component' };
    const createRes = createResponse();
    const getRes = createResponse();
    const deleteRes = createResponse();

    await controller.createEmbeddings(
      createRequest({ params: { source: 'catalog' }, body: { entityFilter: filter } }),
      createRes,
    );
    await controller.getEmbeddings(
      createRequest({
        params: { source: 'catalog' },
        query: { query: ' service docs ' },
        body: { entityFilter: filter },
      }),
      getRes,
    );
    await controller.deleteEmbeddings(
      createRequest({ params: { source: 'catalog' }, body: { entityFilter: filter } }),
      deleteRes,
    );

    expect(augmentationIndexer.createEmbeddings).toHaveBeenCalledWith('catalog', filter);
    expect(retrievalPipeline.retrieveAugmentationContext).toHaveBeenCalledWith(
      'service docs',
      'catalog',
      filter,
    );
    expect(augmentationIndexer.deleteEmbeddings).toHaveBeenCalledWith('catalog', filter);
    expect(createRes.status).toHaveBeenCalledWith(200);
    expect(getRes.status).toHaveBeenCalledWith(200);
    expect(deleteRes.status).toHaveBeenCalledWith(201);
    expect(logger.info).toHaveBeenCalledWith('Creating embeddings for source catalog');
    expect(logger.info).toHaveBeenCalledWith('Created 3 embeddings for source catalog');
    expect(logger.info).toHaveBeenCalledWith('Deleting embeddings for source catalog');
    expect(logger.info).toHaveBeenCalledWith('Deleted embeddings for source catalog');
  });

  it('rejects direct embedding lookup when the query or retrieval pipeline is missing', async () => {
    const withoutPipeline = createController({ retrievalPipeline: null as any });
    const missingPipelineRes = createResponse();

    await withoutPipeline.controller.getEmbeddings(
      createRequest({ params: { source: 'catalog' }, query: { query: 'docs' } }),
      missingPipelineRes,
    );

    expect(missingPipelineRes.status).toHaveBeenCalledWith(500);
    expect(withoutPipeline.logger.warn).toHaveBeenCalledWith(
      'Embedding lookup requested without a configured retrieval pipeline',
    );

    const { controller } = createController();
    const blankQueryRes = createResponse();

    await controller.getEmbeddings(
      createRequest({ params: { source: 'catalog' }, query: { query: '  ' } }),
      blankQueryRes,
    );

    expect(blankQueryRes.status).toHaveBeenCalledWith(422);
    expect(blankQueryRes.body).toEqual({ message: 'query is required' });
  });

  it('streams a new run with normalized query, session creation, and hardening context', async () => {
    const runtime = {
      run: jest.fn(() => events([{ type: 'done', data: { runId: 'generated-run' } }])),
      resume: jest.fn(),
    };
    const sessionStore: SessionStore = {
      createSession: jest.fn(async () => 'session-a'),
      appendMessage: jest.fn(async () => undefined),
      listMessages: jest.fn(async () => []),
    };
    const { controller } = createController({
      runtime,
      sessionStore,
      agents: new Map([
        ['agent-a', createAgent({ memory: 'session' })],
      ]),
      hardening: { maxRetries: 2, retryBackoffMs: 25, maxTotalTokens: 100 },
    });
    const req = createRequest({
      params: { id: 'agent-a' },
      body: { input: { query: '  explain catalog  ', source: 'catalog' } },
    });
    const res = createResponse();

    await controller.startRun(req, res);

    expect(sessionStore.createSession).toHaveBeenCalledWith('agent-a', 'anonymous');
    expect(runtime.run).toHaveBeenCalledTimes(1);
    const runCalls = runtime.run.mock.calls as any[];
    expect(runCalls[0][0]).toEqual({
      runId: expect.any(String),
      agentId: 'agent-a',
      idempotencyKey: undefined,
      trigger: undefined,
      input: {
        query: 'explain catalog',
        source: 'catalog',
        sessionId: 'session-a',
        entityFilter: undefined,
      },
    });
    expect(runCalls[0][1]).toMatchObject({
      systemPrompt: 'System prompt',
      memory: 'session',
      hardening: { maxRetries: 2, retryBackoffMs: 25, maxTotalTokens: 100 },
    });
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'text/event-stream',
    }));
    expect(res.chunks.join('')).toContain('event: done');
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid run requests before opening an event stream', async () => {
    const unknownAgent = createController();
    const unknownRes = createResponse();

    await unknownAgent.controller.startRun(
      createRequest({ params: { id: 'missing' }, body: { input: { query: 'hello' } } }),
      unknownRes,
    );

    expect(unknownRes.status).toHaveBeenCalledWith(422);

    const missingModel = createController({ models: new Map() });
    const missingModelRes = createResponse();

    await missingModel.controller.startRun(
      createRequest({ params: { id: 'agent-a' }, body: { input: { query: 'hello' } } }),
      missingModelRes,
    );

    expect(missingModelRes.status).toHaveBeenCalledWith(500);

    const blankQuery = createController();
    const blankQueryRes = createResponse();

    await blankQuery.controller.startRun(
      createRequest({ params: { id: 'agent-a' }, body: { input: { query: '  ' } } }),
      blankQueryRes,
    );

    expect(blankQueryRes.status).toHaveBeenCalledWith(422);
    expect(blankQueryRes.writeHead).not.toHaveBeenCalled();
  });

  it('returns duplicate runs before consuming rate limits or starting runtime work', async () => {
    const existing = createRun({ id: 'existing-run', status: 'done' });
    const runStore = createRunStore({
      findRunByIdempotencyKey: jest.fn(async () => existing),
    });
    const runtime = { run: jest.fn(), resume: jest.fn() };
    const { controller, logger } = createController({
      runtime,
      runStore,
      hardening: { rateLimitPerMinute: 1 },
    });
    const res = createResponse();

    await controller.startRun(
      createRequest({
        params: { id: 'agent-a' },
        body: { idempotencyKey: 'same-key', input: { query: 'hello' } },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ duplicate: true, runId: 'existing-run', status: 'done' });
    expect(runtime.run).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      "Returning duplicate run 'existing-run' for idempotency key",
    );
  });

  it('enforces per-agent rate limits and logs the rejection', async () => {
    const { controller, logger } = createController({ hardening: { rateLimitPerMinute: 1 } });
    const firstRes = createResponse();
    const secondRes = createResponse();

    await controller.startRun(
      createRequest({ params: { id: 'agent-a' }, body: { input: { query: 'first' } } }),
      firstRes,
    );
    await controller.startRun(
      createRequest({ params: { id: 'agent-a' }, body: { input: { query: 'second' } } }),
      secondRes,
    );

    expect(firstRes.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(secondRes.status).toHaveBeenCalledWith(429);
    expect(logger.warn).toHaveBeenCalledWith("Rate limit exceeded for agent 'agent-a'");
  });

  it('converts runtime failures into SSE error events and logs them', async () => {
    const runtime = {
      run: jest.fn(() => throwingEvents('runtime exploded')),
      resume: jest.fn(),
    };
    const { controller, logger } = createController({ runtime });
    const res = createResponse();

    await controller.startRun(
      createRequest({ params: { id: 'agent-a' }, body: { input: { query: 'hello' } } }),
      res,
    );

    const output = res.chunks.join('');
    expect(output).toContain('event: error');
    expect(output).toContain('runtime exploded');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('runtime exploded'));
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('resumes approved runs over SSE and reports resume failures as events', async () => {
    const decision: ApprovalDecision = { status: 'approved', decidedBy: 'user-a' };
    const runStore = createRunStore({ getRun: jest.fn(async () => createRun()) });
    const runtime = {
      run: jest.fn(),
      resume: jest.fn(() => events([{ type: 'done', data: { runId: 'run-a' } }])),
    };
    const { controller } = createController({ runtime, runStore });
    const res = createResponse();

    await controller.approveRun(
      createRequest({ params: { id: 'run-a' }, body: decision }),
      res,
    );

    const resumeCalls = runtime.resume.mock.calls as any[];
    expect(resumeCalls[0]).toEqual([
      'run-a',
      decision,
      expect.objectContaining({ identity: 'user-a', systemPrompt: 'System prompt' }),
    ]);
    expect(res.chunks.join('')).toContain('event: done');

    const failingRuntime = {
      run: jest.fn(),
      resume: jest.fn(() => throwingEvents('resume failed')),
    };
    const failing = createController({ runtime: failingRuntime, runStore });
    const failingRes = createResponse();

    await failing.controller.approveRun(
      createRequest({ params: { id: 'run-a' }, body: decision }),
      failingRes,
    );

    expect(failingRes.chunks.join('')).toContain('resume failed');
    expect(failing.logger.error).toHaveBeenCalledWith(expect.stringContaining('resume failed'));
  });

  it('rejects invalid approvals and missing persisted run state', async () => {
    const { controller } = createController({ runStore: createRunStore() });
    const invalidRes = createResponse();
    const missingRunRes = createResponse();

    await controller.approveRun(
      createRequest({ params: { id: 'run-a' }, body: { status: 'maybe' } }),
      invalidRes,
    );
    await controller.approveRun(
      createRequest({ params: { id: 'run-a' }, body: { status: 'approved' } }),
      missingRunRes,
    );

    expect(invalidRes.status).toHaveBeenCalledWith(422);
    expect(missingRunRes.status).toHaveBeenCalledWith(404);
  });

  it('replays stored run events after the Last-Event-ID checkpoint', async () => {
    const steps: RunStepRecord[] = [
      { seq: 2, type: 'token', payload: { runId: 'run-a', text: 'hello' } },
      { seq: 3, type: 'unknown', payload: { ignored: true } },
      { seq: 4, type: 'done', payload: { runId: 'run-a' } },
    ];
    const runStore = createRunStore({
      getRun: jest.fn(async () => createRun()),
      listRunSteps: jest.fn(async () => steps),
    });
    const { controller } = createController({ runStore });
    const res = createResponse();

    await controller.streamRunEvents(
      createRequest({ params: { id: 'run-a' }, headers: { 'last-event-id': '1' } }),
      res,
    );

    expect(runStore.listRunSteps).toHaveBeenCalledWith('run-a', 1);
    const output = res.chunks.join('');
    expect(output).toContain('id: 2');
    expect(output).toContain('event: token');
    expect(output).toContain('id: 4');
    expect(output).toContain('event: done');
    expect(output).not.toContain('unknown');
  });

  it('runs named triggers with idempotency and normalized query', async () => {
    const runtime = {
      run: jest.fn(() => events([{ type: 'done', data: { runId: 'run-a' } }])),
      resume: jest.fn(),
    };
    const { controller } = createController({
      runtime,
      triggers: [{ id: 'nightly', source: 'github', agentId: 'agent-a' }],
    });
    const res = createResponse();

    await controller.triggerRun(
      createRequest({
        params: { source: 'github' },
        body: { idempotencyKey: 'github-1', input: { query: '  summarize  ' } },
      }),
      res,
    );

    const runCalls = runtime.run.mock.calls as any[];
    expect(runCalls[0][0]).toMatchObject({
      agentId: 'agent-a',
      idempotencyKey: 'github-1',
      trigger: 'github',
      input: { query: 'summarize', source: 'github' },
    });
    expect(res.chunks.join('')).toContain('event: done');
  });

  it('requires idempotency keys for triggers and returns duplicate trigger runs', async () => {
    const existing = createRun({ id: 'trigger-run', status: 'paused' });
    const runStore = createRunStore({
      findRunByIdempotencyKey: jest.fn(async () => existing),
    });
    const { controller } = createController({ runStore });
    const missingKeyRes = createResponse();
    const duplicateRes = createResponse();

    await controller.triggerRun(
      createRequest({ params: { source: 'github' }, body: { input: { query: 'hello' } } }),
      missingKeyRes,
    );
    await controller.triggerRun(
      createRequest({
        params: { source: 'github' },
        body: { idempotencyKey: 'same', input: { query: 'hello' } },
      }),
      duplicateRes,
    );

    expect(missingKeyRes.status).toHaveBeenCalledWith(422);
    expect(duplicateRes.status).toHaveBeenCalledWith(200);
    expect(duplicateRes.body).toEqual({ duplicate: true, runId: 'trigger-run', status: 'paused' });
  });

  it('normalizes webhook requests into trigger runs', async () => {
    const runtime = {
      run: jest.fn(() => events([{ type: 'done', data: { runId: 'run-a' } }])),
      resume: jest.fn(),
    };
    const { controller } = createController({ runtime });
    const res = createResponse();

    await controller.webhookRun(
      createRequest({
        params: { provider: 'github' },
        headers: { 'x-idempotency-key': 'webhook-key' },
        body: { input: { query: 'opened issue' } },
      }),
      res,
    );

    const runCalls = runtime.run.mock.calls as any[];
    expect(runCalls[0][0]).toMatchObject({
      idempotencyKey: 'webhook-key',
      trigger: 'webhook:github',
      input: { query: 'opened issue', source: 'webhook:github' },
    });
  });
});

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
import { LangGraphOrchestrator } from '../LangGraphOrchestrator';
import type {
  AgentRunInput,
  RunContext,
  Tool,
} from '@webstackbuilders/plugin-ai-core-node';
import {
  collectEvents,
  createAsyncIterable,
  createLogger,
  createRetrievalTool,
  createRunContext,
  defaultEmbeddings,
} from '../../testHelpers';

const input: AgentRunInput = {
  runId: 'run-graph',
  agentId: 'agent-graph',
  input: { query: 'Update the rollout plan', source: 'catalog', sessionId: 'session-1' },
};

const createSessionStore = () => ({
  listMessages: jest.fn(async () => [
    { role: 'user', content: 'What changed yesterday?' },
    { role: 'assistant', content: 'The rollout was delayed.' },
  ]),
  appendMessage: jest.fn(),
});

const createCheckpointStore = (loads: unknown[] = []) => ({
  save: jest.fn(),
  load: jest.fn(async () => loads.shift()),
});

const createLlmService = (chunks: unknown[] = ['graph ', 'answer']) => ({
  query: jest.fn(
    async (_embeddings: unknown, _query: string, _options: unknown) =>
      createAsyncIterable(chunks) as any,
  ),
});

const createContext = (options: {
  logger?: ReturnType<typeof createLogger>;
  retrievalTool?: ReturnType<typeof createRetrievalTool>;
  additionalTools?: Tool[];
  overrides?: Partial<RunContext>;
} = {}) => {
  const logger = options.logger ?? createLogger();
  const retrievalTool = Object.hasOwn(options, 'retrievalTool')
    ? options.retrievalTool
    : createRetrievalTool(defaultEmbeddings);

  return createRunContext({
    logger,
    tools: [...(retrievalTool ? [retrievalTool] : []), ...(options.additionalTools ?? [])],
    overrides: {
      sessionStore: createSessionStore() as any,
      checkpointStore: createCheckpointStore() as any,
      ...options.overrides,
    },
  });
};

describe('LangGraphOrchestrator', () => {
  it('loads history, retrieves context, streams tokens, persists session history, and checkpoints completion', async () => {
    const llmService = createLlmService();
    const ctx = createContext();
    const orchestrator = new LangGraphOrchestrator(llmService as any);

    const events = await collectEvents(orchestrator.run(input, ctx));

    expect(ctx.sessionStore?.listMessages).toHaveBeenCalledWith('session-1', 8);
    expect(llmService.query).toHaveBeenCalledWith(
      defaultEmbeddings,
      expect.stringContaining('Conversation history:'),
      expect.objectContaining({
        model: {},
        systemPrompt: 'Use grounded context',
      }),
    );
    expect(events).toEqual(
      expect.arrayContaining([
        { type: 'token', data: { runId: 'run-graph', text: 'graph ' } },
        { type: 'token', data: { runId: 'run-graph', text: 'answer' } },
        expect.objectContaining({ type: 'usage' }),
        expect.objectContaining({ type: 'done' }),
      ]),
    );
    expect(ctx.sessionStore?.appendMessage).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({ role: 'user', content: input.input.query }),
    );
    expect(ctx.sessionStore?.appendMessage).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({ role: 'assistant', content: 'graph answer' }),
    );
    expect(ctx.checkpointStore?.save).toHaveBeenCalledWith(
      'run-graph',
      expect.objectContaining({ status: 'done', response: 'graph answer' }),
    );
    expect(ctx.logger.info).toHaveBeenCalledWith(
      "LangGraph retrieval completed for run 'run-graph' with 1 embeddings",
    );
  });

  it('logs and yields an error when retrieval is unavailable', async () => {
    const logger = createLogger();
    const llmService = createLlmService();
    const ctx = createContext({ logger, retrievalTool: undefined });
    const orchestrator = new LangGraphOrchestrator(llmService as any);

    const events = await collectEvents(orchestrator.run(input, ctx));

    expect(events).toEqual([
      { type: 'step', data: { runId: 'run-graph', seq: 1, node: 'langgraph', phase: 'enter' } },
      { type: 'error', data: { runId: 'run-graph', message: "Tool 'knowledge.retrieve' is not registered" } },
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      "LangGraph retrieval failed for run 'run-graph': Tool 'knowledge.retrieve' is not registered",
    );
    expect(llmService.query).not.toHaveBeenCalled();
  });

  it('warns and continues with empty embeddings when retrieval returns non-array output', async () => {
    const logger = createLogger();
    const llmService = createLlmService();
    const retrievalTool = createRetrievalTool({ unexpected: true });
    const ctx = createContext({ logger, retrievalTool });
    const orchestrator = new LangGraphOrchestrator(llmService as any);

    const events = await collectEvents(orchestrator.run(input, ctx));

    expect(logger.warn).toHaveBeenCalledWith(
      "Retrieval tool 'knowledge.retrieve' returned non-array output for run 'run-graph'",
    );
    expect(llmService.query).toHaveBeenCalledWith(
      [],
      expect.any(String),
      expect.any(Object),
    );
    expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'done' })]));
  });

  it('uses a fallback message for non-error retrieval failures', async () => {
    const logger = createLogger();
    const retrievalTool = createRetrievalTool();
    retrievalTool.invoke = jest.fn(async () => Promise.reject(undefined));
    const ctx = createContext({ logger, retrievalTool });
    const orchestrator = new LangGraphOrchestrator(createLlmService() as any);

    const events = await collectEvents(orchestrator.run(input, ctx));

    expect(events).toEqual([
      { type: 'step', data: { runId: 'run-graph', seq: 1, node: 'langgraph', phase: 'enter' } },
      { type: 'error', data: { runId: 'run-graph', message: 'Retrieval failed' } },
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      "LangGraph retrieval failed for run 'run-graph': Retrieval failed",
    );
  });

  it('saves an approval checkpoint and yields an approval request for write-intent agents', async () => {
    const checkpointStore = createCheckpointStore();
    const writeTool = {
      id: 'catalog.write',
      effect: 'write',
      invoke: jest.fn(),
    } as Tool;
    const ctx = createContext({
      additionalTools: [writeTool],
      overrides: { checkpointStore: checkpointStore as any },
    });
    const orchestrator = new LangGraphOrchestrator(createLlmService() as any);

    const events = await collectEvents(orchestrator.run(input, ctx));

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'approval_request',
        data: expect.objectContaining({
          runId: 'run-graph',
          approvalId: expect.any(String),
          effect: 'write',
        }),
      }),
    ]));
    expect(checkpointStore.save).toHaveBeenCalledWith(
      'run-graph',
      expect.objectContaining({ status: 'awaiting_approval' }),
    );
  });

  it('logs and yields an error when resume has no checkpoint', async () => {
    const logger = createLogger();
    const checkpointStore = createCheckpointStore([undefined]);
    const ctx = createContext({ logger, overrides: { checkpointStore: checkpointStore as any } });
    const orchestrator = new LangGraphOrchestrator(createLlmService() as any);

    const events = await collectEvents(
      orchestrator.resume('run-graph', { status: 'approved' }, ctx),
    );

    expect(events).toEqual([
      { type: 'error', data: { runId: 'run-graph', message: "No checkpoint found for run 'run-graph'" } },
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      "LangGraph resume requested without checkpoint for run 'run-graph'",
    );
  });

  it('logs and yields an error when resume approval is rejected', async () => {
    const logger = createLogger();
    const checkpointStore = createCheckpointStore([{ status: 'awaiting_approval' }]);
    const ctx = createContext({ logger, overrides: { checkpointStore: checkpointStore as any } });
    const orchestrator = new LangGraphOrchestrator(createLlmService() as any);

    const events = await collectEvents(
      orchestrator.resume('run-graph', { status: 'rejected', note: 'Needs owner review' }, ctx),
    );

    expect(events).toEqual([
      { type: 'error', data: { runId: 'run-graph', message: 'Needs owner review' } },
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      "LangGraph resume rejected for run 'run-graph': Needs owner review",
    );
  });

  it('completes approved resume and saves the approved checkpoint', async () => {
    const checkpointStore = createCheckpointStore([{
      agentId: 'agent-graph',
      sessionId: 'session-1',
      proposedArtifact: { kind: 'draft', ref: 'pending-write-action' },
    }]);
    const ctx = createContext({ overrides: { checkpointStore: checkpointStore as any } });
    const orchestrator = new LangGraphOrchestrator(createLlmService() as any);

    const events = await collectEvents(
      orchestrator.resume('run-graph', { status: 'approved' }, ctx),
    );

    expect(events).toEqual([
      expect.objectContaining({ type: 'step', data: expect.objectContaining({ node: 'approval.resume', phase: 'enter' }) }),
      expect.objectContaining({
        type: 'artifact',
        data: expect.objectContaining({ ref: 'pending-write-action' }),
      }),
    ]);
    expect(checkpointStore.save).toHaveBeenCalledWith(
      'run-graph',
      expect.objectContaining({ status: 'done', resumedAt: expect.any(String) }),
    );
  });
});

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
import { CrewOrchestrator } from '../CrewOrchestrator';
import type {
  AgentDefinition,
  AgentRunInput,
  RunContext,
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
  runId: 'run-crew',
  agentId: 'agent-crew',
  input: { query: 'Summarize the rollout risk', source: 'catalog' },
};

const agent: AgentDefinition = {
  id: 'agent-crew',
  modelRef: 'fallback-model',
  systemPrompt: 'Coordinate specialized roles',
  toolIds: [],
  crew: {
    roles: [
      {
        id: 'researcher',
        systemPrompt: 'Collect evidence',
        modelRef: 'research-model',
      },
      {
        id: 'writer',
        systemPrompt: 'Write final answer',
        modelRef: 'missing-model',
      },
    ],
  },
};

const createCheckpointStore = () => ({
  save: jest.fn(),
  load: jest.fn(),
});

const createModel = (label: string) => ({
  label,
  metadata: { llmProvider: label },
});

const createLlmService = () => {
  const streams = [
    createAsyncIterable(['research notes']),
    createAsyncIterable(['final ', 'answer']),
  ];

  return {
    query: jest.fn(
      async (_embeddings: unknown, _query: string, _options: unknown) =>
        streams.shift() as any,
    ),
  };
};

const createContext = (options: {
  logger?: ReturnType<typeof createLogger>;
  retrievalTool?: ReturnType<typeof createRetrievalTool>;
  overrides?: Partial<RunContext>;
} = {}) => {
  const logger = options.logger ?? createLogger();
  const retrievalTool = Object.hasOwn(options, 'retrievalTool')
    ? options.retrievalTool
    : createRetrievalTool(defaultEmbeddings);

  return createRunContext({
    logger,
    tools: retrievalTool ? [retrievalTool] : [],
    overrides: {
      model: createModel('fallback-model') as any,
      checkpointStore: createCheckpointStore() as any,
      ...options.overrides,
    },
  });
};

describe('CrewOrchestrator', () => {
  it('chains configured roles and only streams the final role output', async () => {
    const llmService = createLlmService();
    const ctx = createContext();
    const orchestrator = new CrewOrchestrator(
      llmService as any,
      new Map([[agent.id, agent]]),
      new Map([['research-model', createModel('research-model') as any]]),
    );

    const events = await collectEvents(orchestrator.run(input, ctx));

    expect(llmService.query).toHaveBeenCalledTimes(2);
    expect(llmService.query).toHaveBeenNthCalledWith(
      1,
      defaultEmbeddings,
      'Summarize the rollout risk',
      expect.objectContaining({
        model: expect.objectContaining({ label: 'research-model' }),
      }),
    );
    expect(llmService.query).toHaveBeenNthCalledWith(
      2,
      defaultEmbeddings,
      expect.stringContaining('Previous role output:\nresearch notes'),
      expect.objectContaining({
        model: expect.objectContaining({ label: 'fallback-model' }),
      }),
    );
    expect(events.filter(event => event.type === 'token')).toEqual([
      { type: 'token', data: { runId: 'run-crew', text: 'final ' } },
      { type: 'token', data: { runId: 'run-crew', text: 'answer' } },
    ]);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool_result',
          data: expect.objectContaining({
            tool: 'knowledge.retrieve',
            ok: true,
            summary: '1 embeddings retrieved',
          }),
        }),
        expect.objectContaining({
          type: 'artifact',
          data: expect.objectContaining({ kind: 'doc', ref: 'crew-output' }),
        }),
        expect.objectContaining({ type: 'usage' }),
        expect.objectContaining({ type: 'done' }),
      ]),
    );
    expect(ctx.checkpointStore?.save).toHaveBeenCalledWith(
      'run-crew',
      expect.objectContaining({ status: 'done', output: 'final answer' }),
    );
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      "Crew role 'writer' references unknown model 'missing-model', falling back to run model",
    );
  });

  it('uses default crew roles when the agent has no crew configuration', async () => {
    const streams = [
      createAsyncIterable(['analysis']),
      createAsyncIterable(['draft']),
      createAsyncIterable(['done']),
    ];
    const llmService = {
      query: jest.fn(
        async (_embeddings: unknown, _query: string, _options: unknown) =>
          streams.shift() as any,
      ),
    };
    const ctx = createContext();
    const orchestrator = new CrewOrchestrator(
      llmService as any,
      new Map([
        [
          input.agentId,
          {
            id: input.agentId,
            modelRef: 'fallback-model',
            systemPrompt: 'Use grounded context',
            toolIds: [],
          },
        ],
      ]),
      new Map(),
    );

    const events = await collectEvents(orchestrator.run(input, ctx));

    expect(llmService.query).toHaveBeenCalledTimes(3);
    expect(events.filter(event => event.type === 'token')).toEqual([
      { type: 'token', data: { runId: 'run-crew', text: 'done' } },
    ]);
  });

  it('logs and yields an error when the retrieval tool is missing', async () => {
    const logger = createLogger();
    const llmService = createLlmService();
    const ctx = createContext({ logger, retrievalTool: undefined });
    const orchestrator = new CrewOrchestrator(
      llmService as any,
      new Map([[agent.id, agent]]),
      new Map(),
    );

    const events = await collectEvents(orchestrator.run(input, ctx));

    expect(events).toEqual([
      { type: 'step', data: { runId: 'run-crew', seq: 1, node: 'crew', phase: 'enter' } },
      { type: 'error', data: { runId: 'run-crew', message: "Tool 'knowledge.retrieve' is not registered" } },
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      "Crew retrieval failed for run 'run-crew': Tool 'knowledge.retrieve' is not registered",
    );
    expect(llmService.query).not.toHaveBeenCalled();
  });

  it('warns and continues with empty embeddings for non-array retrieval output', async () => {
    const logger = createLogger();
    const retrievalTool = createRetrievalTool({ unexpected: true });
    const llmService = createLlmService();
    const ctx = createContext({ logger, retrievalTool });
    const orchestrator = new CrewOrchestrator(
      llmService as any,
      new Map([[agent.id, agent]]),
      new Map(),
    );

    const events = await collectEvents(orchestrator.run(input, ctx));

    expect(logger.warn).toHaveBeenCalledWith(
      "Retrieval tool 'knowledge.retrieve' returned non-array output for run 'run-crew'",
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool_result',
          data: expect.objectContaining({ summary: '0 embeddings retrieved' }),
        }),
        expect.objectContaining({ type: 'done' }),
      ]),
    );
  });

  it('uses a fallback message for non-error retrieval failures', async () => {
    const logger = createLogger();
    const retrievalTool = createRetrievalTool();
    retrievalTool.invoke = jest.fn(async () => Promise.reject(undefined));
    const ctx = createContext({ logger, retrievalTool });
    const orchestrator = new CrewOrchestrator(
      createLlmService() as any,
      new Map([[agent.id, agent]]),
      new Map(),
    );

    const events = await collectEvents(orchestrator.run(input, ctx));

    expect(events).toEqual([
      { type: 'step', data: { runId: 'run-crew', seq: 1, node: 'crew', phase: 'enter' } },
      { type: 'error', data: { runId: 'run-crew', message: 'Retrieval failed' } },
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      "Crew retrieval failed for run 'run-crew': Retrieval failed",
    );
  });
});

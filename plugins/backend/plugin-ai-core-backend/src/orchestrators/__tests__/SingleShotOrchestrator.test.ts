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
  AgentRunInput,
  Tool,
} from '@webstackbuilders/plugin-ai-core-node';
import {
  collectEvents,
  createLlmService,
  createLogger,
  createRetrievalTool,
  createRunContext,
  defaultEmbeddings,
} from '../../testHelpers';
import { SingleShotOrchestrator } from '../SingleShotOrchestrator';

const input: AgentRunInput = {
  runId: 'run-1',
  agentId: 'agent-a',
  input: {
    query: 'Who owns this service?',
    source: 'catalog',
    sessionId: 'session-1',
    entityFilter: { kind: 'Component' },
  },
};

const createContext = (options: {
  logger?: ReturnType<typeof createLogger>;
  tool?: Tool;
} = {}) => {
  const logger = options.logger ?? createLogger();
  const tool = Object.hasOwn(options, 'tool')
    ? options.tool
    : createRetrievalTool();

  return createRunContext({ logger, tools: tool ? [tool] : [] });
};

describe('SingleShotOrchestrator', () => {
  it('retrieves context, streams tokens, emits usage, and completes', async () => {
    const logger = createLogger();
    const retrievalTool = createRetrievalTool();
    const usageChunk = {
      content: '!',
      usage_metadata: { input_tokens: 3, output_tokens: 4, total_tokens: 7 },
    };
    const llmService = createLlmService(['hello ', 'world', usageChunk]);
    const orchestrator = new SingleShotOrchestrator(llmService as any);

    const events = await collectEvents(
      orchestrator.run(input, createContext({ logger, tool: retrievalTool })),
    );

    expect(events).toEqual([
      { type: 'step', data: { runId: 'run-1', seq: 1, node: 'single-shot', phase: 'enter' } },
      { type: 'token', data: { runId: 'run-1', text: 'hello ' } },
      { type: 'token', data: { runId: 'run-1', text: 'world' } },
      { type: 'token', data: { runId: 'run-1', text: '!' } },
      { type: 'usage', data: { runId: 'run-1', input: 3, output: 4, total: 7 } },
      { type: 'step', data: { runId: 'run-1', seq: 2, node: 'single-shot', phase: 'exit' } },
      { type: 'done', data: { runId: 'run-1', sessionId: 'session-1' } },
    ]);
    expect(retrievalTool.invoke).toHaveBeenCalledWith(
      {
        query: 'Who owns this service?',
        source: 'catalog',
        entityFilter: { kind: 'Component' },
      },
      expect.objectContaining({
        logger,
        identity: 'user:default/alice',
        runId: 'run-1',
      }),
    );
    expect(llmService.query).toHaveBeenCalledWith(defaultEmbeddings, 'Who owns this service?', {
      model: {},
      systemPrompt: 'Use grounded context',
    });
    expect(logger.info).toHaveBeenCalledWith(
      "Single-shot retrieval completed for run 'run-1' with 1 embeddings",
    );
  });

  it('logs and yields an error when the retrieval tool is missing', async () => {
    const logger = createLogger();
    const llmService = createLlmService();
    const orchestrator = new SingleShotOrchestrator(llmService as any);

    const events = await collectEvents(
      orchestrator.run(input, createContext({ logger, tool: undefined })),
    );

    expect(events).toEqual([
      { type: 'step', data: { runId: 'run-1', seq: 1, node: 'single-shot', phase: 'enter' } },
      {
        type: 'error',
        data: { runId: 'run-1', message: "Tool 'knowledge.retrieve' is not registered" },
      },
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      "Single-shot retrieval failed for run 'run-1': Tool 'knowledge.retrieve' is not registered",
    );
    expect(llmService.query).not.toHaveBeenCalled();
  });

  it('warns and continues with empty context when retrieval returns non-array output', async () => {
    const logger = createLogger();
    const retrievalTool = createRetrievalTool({ unexpected: true });
    const llmService = createLlmService([]);
    const orchestrator = new SingleShotOrchestrator(llmService as any);

    const events = await collectEvents(
      orchestrator.run(input, createContext({ logger, tool: retrievalTool })),
    );

    expect(llmService.query).toHaveBeenCalledWith([], 'Who owns this service?', {
      model: {},
      systemPrompt: 'Use grounded context',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      "Retrieval tool 'knowledge.retrieve' returned non-array output for run 'run-1'",
    );
    expect(events).toContainEqual({
      type: 'usage',
      data: { runId: 'run-1', input: -1, output: -1, total: -1 },
    });
  });

  it('uses a fallback message when retrieval throws a non-error value', async () => {
    const logger = createLogger();
    const retrievalTool = {
      id: 'knowledge.retrieve',
      effect: 'read',
      invoke: jest.fn(async () => Promise.reject(undefined)),
    } as Tool;
    const orchestrator = new SingleShotOrchestrator(createLlmService() as any);

    const events = await collectEvents(
      orchestrator.run(input, createContext({ logger, tool: retrievalTool })),
    );

    expect(events).toEqual([
      { type: 'step', data: { runId: 'run-1', seq: 1, node: 'single-shot', phase: 'enter' } },
      { type: 'error', data: { runId: 'run-1', message: 'Retrieval failed' } },
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      "Single-shot retrieval failed for run 'run-1': Retrieval failed",
    );
  });
});
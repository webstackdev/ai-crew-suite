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
import { describe, expect, it, vi, type Mock } from 'vitest';
import type { BaseLLM } from '@langchain/core/language_models/llms';
import type { EmbeddingDoc } from '@webstackbuilders/plugin-ai-core-node';
import { createAsyncIterable, createLogger } from '../../testHelpers';
import { LlmService } from '../LlmService';

const createStream = () =>
  createAsyncIterable(['response chunk']) as any;

const createModel = (stream = createStream()) =>
  ({
    stream: vi.fn(async (_prompt: string) => stream),
  }) as unknown as BaseLLM & { stream: Mock };

const embeddings: EmbeddingDoc[] = [
  { content: 'catalog-info.yaml owner: platform', metadata: { source: 'catalog' } },
  { content: 'techdocs mention lifecycle: production', metadata: { source: 'techdocs' } },
];

describe('LlmService', () => {
  it('builds a default grounded prompt and starts the model stream', async () => {
    const logger = createLogger();
    const modelStream = createStream();
    const model = createModel(modelStream);
    const service = new LlmService({ logger: logger as any });

    const result = await service.query(embeddings, 'Who owns this service?', {
      model,
    });

    expect(result).toBe(modelStream);
    expect(logger.info).toHaveBeenCalledWith(
      'Starting LLM prompt stream with 2 embedding docs',
    );
    expect(model.stream).toHaveBeenCalledTimes(1);
    const prompt = model.stream.mock.calls[0][0] as string;
    expect(prompt).toContain('Human:');
    expect(prompt).toContain('Only use information provided by the embedded documentation');
    expect(prompt).toContain('catalog-info.yaml owner: platform');
    expect(prompt).toContain('techdocs mention lifecycle: production');
    expect(prompt).toContain('Question: Who owns this service?');
    expect(prompt).toContain('Assistant:');
  });

  it('uses configured prompts when no per-query system prompt is provided', async () => {
    const model = createModel();
    const service = new LlmService({
      logger: createLogger() as any,
      configuredPrompts: {
        prefix: 'Use this curated context:',
        suffix: 'Answer this request:',
      },
    });

    await service.query([embeddings[0]], 'List dependencies', { model });

    const prompt = model.stream.mock.calls[0][0] as string;
    expect(prompt).toContain('Use this curated context:  catalog-info.yaml owner: platform');
    expect(prompt).toContain('Answer this request: List dependencies');
    expect(prompt).not.toContain('Question:');
  });

  it('uses a per-query system prompt before configured prefix text', async () => {
    const model = createModel();
    const service = new LlmService({
      logger: createLogger() as any,
      configuredPrompts: {
        prefix: 'Configured prefix should not be used',
        suffix: 'Configured suffix:',
      },
    });

    await service.query([embeddings[0]], 'Summarize ownership', {
      model,
      systemPrompt: 'Use the incident response policy:',
    });

    const prompt = model.stream.mock.calls[0][0] as string;
    expect(prompt).toContain(
      'Use the incident response policy:  catalog-info.yaml owner: platform',
    );
    expect(prompt).not.toContain('Configured prefix should not be used');
    expect(prompt).toContain('Configured suffix: Summarize ownership');
  });

  it('logs and rethrows model stream startup failures', async () => {
    const logger = createLogger();
    const failure = new Error('provider unavailable');
    const model = {
      stream: vi.fn(async () => {
        throw failure;
      }),
    } as unknown as BaseLLM;
    const service = new LlmService({ logger: logger as any });

    await expect(
      service.query(embeddings, 'Who owns this service?', { model }),
    ).rejects.toThrow(failure);

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to start LLM prompt stream: provider unavailable',
    );
  });
});
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
import { describe, expect, it, vi } from 'vitest';
import type {
  AugmentationPostProcessor,
  AugmentationRetriever,
  EmbeddingDoc,
  RetrievalRouter,
} from '@webstackbuilders/plugin-ai-core-node';
import { DefaultRetrievalPipeline } from '../DefaultRetrievalPipeline';

const doc = (content: string): EmbeddingDoc => ({
  content,
  metadata: { source: 'catalog' },
});

const createRetriever = (
  id: string,
  documents: EmbeddingDoc[],
): AugmentationRetriever => ({
  id,
  retrieve: vi.fn(async () => documents),
});

const createRouter = (
  retrievers: AugmentationRetriever[],
): RetrievalRouter => ({
  determineRetriever: vi.fn(async () => retrievers),
});

describe('DefaultRetrievalPipeline', () => {
  it('runs direct retrievers before routed retrievers and forwards filters', async () => {
    const directRetriever = createRetriever('direct', [doc('direct')]);
    const routedRetriever = createRetriever('routed', [doc('routed')]);
    const router = createRouter([routedRetriever]);
    const filter = { kind: 'Component' };
    const pipeline = new DefaultRetrievalPipeline({
      routers: [router],
      retrievers: [directRetriever],
    });

    const results = await pipeline.retrieveAugmentationContext(
      'service owner',
      'catalog',
      filter,
    );

    expect(router.determineRetriever).toHaveBeenCalledWith(
      'service owner',
      'catalog',
    );
    expect(directRetriever.retrieve).toHaveBeenCalledWith(
      'service owner',
      'catalog',
      filter,
    );
    expect(routedRetriever.retrieve).toHaveBeenCalledWith(
      'service owner',
      'catalog',
      filter,
    );
    expect(results).toEqual([doc('direct'), doc('routed')]);
  });

  it('merges documents from retrievers that share an id', async () => {
    const firstRetriever = createRetriever('shared', [doc('first')]);
    const secondRetriever = createRetriever('shared', [doc('second')]);
    const postProcessor: AugmentationPostProcessor = {
      process: vi.fn(async (_query, _source, embeddingDocs) =>
        embeddingDocs.get('shared') ?? [],
      ),
    };
    const pipeline = new DefaultRetrievalPipeline({
      retrievers: [firstRetriever, secondRetriever],
      postProcessors: [postProcessor],
    });

    const results = await pipeline.retrieveAugmentationContext(
      'service owner',
      'catalog',
    );

    expect(postProcessor.process).toHaveBeenCalledWith(
      'service owner',
      'catalog',
      new Map([['shared', [doc('first'), doc('second')]]]),
    );
    expect(results).toEqual([doc('first'), doc('second')]);
  });

  it('flattens output from multiple post-processors', async () => {
    const retriever = createRetriever('direct', [doc('direct')]);
    const firstPostProcessor: AugmentationPostProcessor = {
      process: vi.fn(async () => [doc('first')]),
    };
    const secondPostProcessor: AugmentationPostProcessor = {
      process: vi.fn(async () => [doc('second')]),
    };
    const pipeline = new DefaultRetrievalPipeline({
      retrievers: [retriever],
      postProcessors: [firstPostProcessor, secondPostProcessor],
    });

    await expect(
      pipeline.retrieveAugmentationContext('service owner', 'catalog'),
    ).resolves.toEqual([doc('first'), doc('second')]);
  });

  it('propagates retriever failures to the caller', async () => {
    const failure = new Error('vector store unavailable');
    const retriever: AugmentationRetriever = {
      id: 'failing',
      retrieve: vi.fn(async () => Promise.reject(failure)),
    };
    const pipeline = new DefaultRetrievalPipeline({ retrievers: [retriever] });

    await expect(
      pipeline.retrieveAugmentationContext('service owner', 'catalog'),
    ).rejects.toThrow('vector store unavailable');
  });
});

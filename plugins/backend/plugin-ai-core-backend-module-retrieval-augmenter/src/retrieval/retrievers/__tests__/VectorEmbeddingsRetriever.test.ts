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
import type { VectorStore } from '@webstackbuilders/plugin-ai-core-node';
import { VectorEmbeddingsRetriever } from '../VectorEmbeddingsRetriever';

const docs = [
  { content: 'service owner: platform', metadata: { source: 'catalog' } },
];

const createLogger = () => ({
  info: vi.fn(),
  error: vi.fn(),
});

const createVectorStore = (
  similaritySearch = vi.fn(async () => docs),
): VectorStore => ({
  connectEmbeddings: vi.fn(),
  addDocuments: vi.fn(),
  deleteDocuments: vi.fn(),
  similaritySearch,
});

describe('VectorEmbeddingsRetriever', () => {
  it('retrieves source-filtered documents from the vector store and logs the result count', async () => {
    const logger = createLogger();
    const vectorStore = createVectorStore();
    const retriever = new VectorEmbeddingsRetriever({
      vectorStore,
      logger: logger as any,
    });

    await expect(
      retriever.retrieve('who owns this service?', 'catalog'),
    ).resolves.toBe(docs);

    expect(retriever.id).toBe('VectorEmbeddingsRetriever');
    expect(vectorStore.similaritySearch).toHaveBeenCalledWith(
      'who owns this service?',
      { source: 'catalog' },
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Received 1 embeddings from Vector store',
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('searches all sources without applying an undefined source filter', async () => {
    const logger = createLogger();
    const vectorStore = createVectorStore();
    const retriever = new VectorEmbeddingsRetriever({
      vectorStore,
      logger: logger as any,
    });

    await retriever.retrieve('deployment docs', 'all');

    expect(vectorStore.similaritySearch).toHaveBeenCalledWith(
      'deployment docs',
      undefined,
    );
  });

  it('logs vector-store failures and rethrows the original error', async () => {
    const logger = createLogger();
    const error = new Error('vector store unavailable');
    const vectorStore = createVectorStore(vi.fn(async () => Promise.reject(error)));
    const retriever = new VectorEmbeddingsRetriever({
      vectorStore,
      logger: logger as any,
    });

    await expect(
      retriever.retrieve('deployment docs', 'tech-docs'),
    ).rejects.toThrow(error);

    expect(logger.error).toHaveBeenCalledWith(
      "Vector embeddings retrieval failed for source 'tech-docs': vector store unavailable",
    );
    expect(logger.info).not.toHaveBeenCalled();
  });
});

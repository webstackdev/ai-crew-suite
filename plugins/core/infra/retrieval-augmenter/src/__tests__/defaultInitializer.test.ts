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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AuthService,
  DiscoveryService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import type { VectorStore } from '@webstackbuilders/plugin-ai-core-node';
import { createDefaultRetrievalPipeline } from '../defaultInitializer';

const createLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}) as unknown as LoggerService & {
  info: ReturnType<typeof vi.fn>;
  child: ReturnType<typeof vi.fn>;
};

const createAuth = (): AuthService => ({
  getOwnServiceCredentials: vi.fn().mockResolvedValue({ principal: 'ai-core' }),
  getPluginRequestToken: vi.fn().mockResolvedValue({ token: 'search-token' }),
}) as unknown as AuthService;

const createDiscovery = (): DiscoveryService => ({
  getBaseUrl: vi.fn().mockResolvedValue('https://backstage.example/search'),
}) as unknown as DiscoveryService;

const createVectorStore = (): VectorStore => ({
  connectEmbeddings: vi.fn(),
  addDocuments: vi.fn(),
  deleteDocuments: vi.fn(),
  similaritySearch: vi.fn(async (_query, filter) => [
    {
      content: filter?.source ? `vector:${filter.source}` : 'vector:all',
      metadata: filter ?? {},
    },
  ]),
});

describe('createDefaultRetrievalPipeline', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: [
          {
            document: {
              location: 'search:result',
              text: 'search result',
            },
          },
        ],
      }),
    } as unknown as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['catalog', 'software-catalog'],
    ['tech-docs', 'techdocs'],
  ] as const)(
    'wires vector and search retrievers for %s source',
    async (source, searchType) => {
      const vectorStore = createVectorStore();
      const pipeline = createDefaultRetrievalPipeline({
        vectorStore,
        discovery: createDiscovery(),
        logger: createLogger(),
        auth: createAuth(),
      });

      const results = await pipeline.retrieveAugmentationContext(
        'service owner',
        source,
      );

      expect(vectorStore.similaritySearch).toHaveBeenCalledWith(
        'service owner',
        { source },
      );
      expect(global.fetch).toHaveBeenCalledWith(
        `https://backstage.example/search/query?term=service+owner&types%5B0%5D=${searchType}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer search-token',
          }),
        }),
      );
      expect(results).toEqual([
        { content: `vector:${source}`, metadata: { source } },
        {
          content: 'search result',
          metadata: { source, location: 'search:result' },
        },
      ]);
    },
  );

  it('wires all source to search every indexed source and all vector documents', async () => {
    const vectorStore = createVectorStore();
    const pipeline = createDefaultRetrievalPipeline({
      vectorStore,
      discovery: createDiscovery(),
      logger: createLogger(),
      auth: createAuth(),
    });

    const results = await pipeline.retrieveAugmentationContext(
      'service owner',
      'all',
    );

    expect(vectorStore.similaritySearch).toHaveBeenCalledWith(
      'service owner',
      undefined,
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'https://backstage.example/search/query?term=service+owner',
      expect.any(Object),
    );
    expect(results).toEqual([
      { content: 'vector:all', metadata: {} },
      {
        content: 'search result',
        metadata: { source: 'all', location: 'search:result' },
      },
    ]);
  });
});

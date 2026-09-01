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
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogApi } from '@backstage/catalog-client';
import type {
  AuthService,
  DiscoveryService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import type { Entity } from '@backstage/catalog-model';
import type { Embeddings } from '@langchain/core/embeddings';
import type { VectorStore } from '@webstackbuilders/plugin-ai-core-node';
import type { AugmentationOptions } from '../../@types';
import { DefaultVectorAugmentationIndexer } from '../DefaultVectorAugmentationIndexer';

type TestVectorAugmentationIndexerOptions = {
  vectorStore: VectorStore;
  catalogApi: CatalogApi;
  logger: LoggerService;
  auth: AuthService;
  embeddings: Embeddings;
  discovery: DiscoveryService;
  augmentationOptions?: AugmentationOptions;
};

class TestVectorAugmentationIndexer extends DefaultVectorAugmentationIndexer {
  public readonly testHarness: true;

  constructor(options: TestVectorAugmentationIndexerOptions) {
    super(options);
    this.testHarness = true;
  }

  protected override getSplitter() {
    return {
      splitText: vi.fn(async (text: string) => [`chunk:${text}`]),
    } as any;
  }
}

const catalogEntity = (name: string, annotations: Record<string, string> = {}): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    namespace: 'default',
    name,
    annotations,
  },
}) as Entity;

const createLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
}) as unknown as LoggerService & {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
};

const createAuth = (): AuthService => ({
  getOwnServiceCredentials: vi.fn().mockResolvedValue({ principal: 'ai-core' }),
  getPluginRequestToken: vi.fn().mockResolvedValue({ token: 'service-token' }),
}) as unknown as AuthService;

const createCatalogApi = (entities: Entity[]): CatalogApi => ({
  getEntities: vi.fn().mockResolvedValue({ items: entities }),
}) as unknown as CatalogApi;

const createDiscovery = (): DiscoveryService => ({
  getBaseUrl: vi.fn().mockResolvedValue('https://backstage.example/techdocs'),
}) as unknown as DiscoveryService;

const createVectorStore = (): VectorStore => ({
  connectEmbeddings: vi.fn(),
  addDocuments: vi.fn(),
  deleteDocuments: vi.fn(),
  similaritySearch: vi.fn(),
});

const createIndexer = ({
  catalogApi = createCatalogApi([catalogEntity('service-a')]),
  logger = createLogger(),
  vectorStore = createVectorStore(),
  auth = createAuth(),
  discovery = createDiscovery(),
}: {
  catalogApi?: CatalogApi;
  logger?: ReturnType<typeof createLogger>;
  vectorStore?: VectorStore;
  auth?: AuthService;
  discovery?: DiscoveryService;
} = {}) => ({
  indexer: new TestVectorAugmentationIndexer({
    vectorStore,
    catalogApi,
    logger,
    auth,
    embeddings: {} as Embeddings,
    discovery,
  }),
  catalogApi,
  logger,
  vectorStore,
  auth,
  discovery,
});

describe('DefaultVectorAugmentationIndexer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects embeddings to the vector store during construction', () => {
    const vectorStore = createVectorStore();

    createIndexer({ vectorStore });

    expect(vectorStore.connectEmbeddings).toHaveBeenCalledWith({});
  });

  it('replaces catalog embeddings and records entity metadata', async () => {
    const entity = catalogEntity('service-a');
    const { indexer, catalogApi, vectorStore, logger, auth } = createIndexer({
      catalogApi: createCatalogApi([entity]),
    });

    const count = await indexer.createEmbeddings('catalog', { kind: 'Component' });

    expect(count).toBe(1);
    expect(auth.getPluginRequestToken).toHaveBeenCalledWith({
      onBehalfOf: { principal: 'ai-core' },
      targetPluginId: 'catalog',
    });
    expect(catalogApi.getEntities).toHaveBeenCalledWith(
      { filter: { kind: 'Component' } },
      { token: 'service-token' },
    );
    expect(vectorStore.deleteDocuments).toHaveBeenCalledWith({
      filter: { source: 'catalog', entityRef: 'component:default/service-a' },
    });
    expect(vectorStore.addDocuments).toHaveBeenCalledWith([
      expect.objectContaining({
        content: expect.stringContaining('chunk:'),
        metadata: expect.objectContaining({
          source: 'catalog',
          entityRef: 'component:default/service-a',
          kind: 'Component',
          splitId: '0',
        }),
      }),
    ]);
    expect(logger.info).toHaveBeenCalledWith(
      'Constructed 1 embedding documents for 1 catalog items.',
    );
  });

  it('indexes available TechDocs sections and skips failed search indexes', async () => {
    const logger = createLogger();
    const entities = [
      catalogEntity('service-a', { 'backstage.io/techdocs-ref': 'dir:.' }),
      catalogEntity('service-b', { 'backstage.io/techdocs-ref': 'dir:.' }),
    ];
    const { indexer, vectorStore, discovery } = createIndexer({
      catalogApi: createCatalogApi(entities),
      logger,
    });
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          docs: [
            { location: 'index.html', text: 'ignored', title: 'Overview' },
            { location: 'index.html#section', text: 'Indexed docs', title: 'Overview' },
          ],
        }),
      } as unknown as Response)
      .mockRejectedValueOnce(new Error('missing search index'));

    const count = await indexer.createEmbeddings('tech-docs', { kind: 'Component' });

    expect(count).toBe(1);
    expect(discovery.getBaseUrl).toHaveBeenCalledWith('techdocs');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://backstage.example/techdocs/static/docs/default/Component/service-a/search/search_index.json',
      { headers: { Authorization: 'Bearer service-token' } },
    );
    expect(vectorStore.addDocuments).toHaveBeenCalledWith([
      expect.objectContaining({
        content: 'chunk:Indexed docs',
        metadata: expect.objectContaining({
          source: 'tech-docs',
          entityRef: 'component:default/service-a',
          title: 'Overview',
          location: 'index.html#section',
        }),
      }),
    ]);
    expect(logger.debug).toHaveBeenCalledWith(
      'Failed to retrieve tech docs search index for entity default/Component/service-b',
      expect.any(Error),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Constructed 1 embedding documents for 2 TechDocs.',
    );
  });

  it('fails unsupported sources before deleting existing documents', async () => {
    const { indexer, vectorStore, catalogApi, logger } = createIndexer();

    await expect(
      indexer.createEmbeddings('custom-source', undefined),
    ).rejects.toThrow(
      'Attempting to create embeddings for a source not implemented yet: custom-source',
    );

    expect(logger.warn).toHaveBeenCalledWith(
      "Attempted to create embeddings for unsupported source 'custom-source'.",
    );
    expect(catalogApi.getEntities).not.toHaveBeenCalled();
    expect(vectorStore.deleteDocuments).not.toHaveBeenCalled();
    expect(vectorStore.addDocuments).not.toHaveBeenCalled();
  });
});

/*
 * Copyright 2024 Larder Software Limited
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
import pLimit from 'p-limit';
import { Embeddings } from '@langchain/core/embeddings';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import {
  AuthService,
  DiscoveryService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import {
  CATALOG_FILTER_EXISTS,
  CatalogApi,
} from '@backstage/catalog-client';
import {
  Entity,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import {
  AugmentationIndexer,
  EmbeddingDoc,
  EmbeddingsSource,
  EntityFilterShape,
  VectorStore,
} from '@webstackbuilders/plugin-ai-core-node';
import {
  SearchIndex,
  AugmentationOptions,
  TechDocsDocument,
} from '../@types';

const TECHDOCS_ENTITY_FILTER = {
  'metadata.annotations.backstage.io/techdocs-ref': CATALOG_FILTER_EXISTS,
};

const SUPPORTED_EMBEDDING_SOURCES = new Set<EmbeddingsSource>([
  'catalog',
  'tech-docs',
]);

/**
 * Base indexer that converts Backstage catalog and TechDocs content into vector documents.
 *
 * Subclasses provide the embedding model through the protected constructor. The
 * indexer handles catalog authentication, document chunking, vector-store writes,
 * and best-effort TechDocs search-index loading. Catalog/auth/vector-store
 * failures are allowed to propagate so callers can retry or fail the indexing
 * job, while individual TechDocs search-index failures are logged at debug level
 * and skipped so one broken TechDocs site does not block the entire source.
 */
export class DefaultVectorAugmentationIndexer implements AugmentationIndexer {
  private readonly _vectorStore: VectorStore;
  private readonly catalogApi: CatalogApi;
  private readonly logger: LoggerService;
  private readonly auth: AuthService;
  private readonly discovery: DiscoveryService;

  private readonly augmentationOptions?: AugmentationOptions;

  /**
   * Creates a vector augmentation indexer and connects the embedding model to the vector store.
   */
  protected constructor({
    vectorStore,
    catalogApi,
    logger,
    auth,
    embeddings,
    discovery,
    augmentationOptions,
  }: {
    vectorStore: VectorStore;
    catalogApi: CatalogApi;
    logger: LoggerService;
    auth: AuthService;
    embeddings: Embeddings;
    discovery: DiscoveryService;
    augmentationOptions?: AugmentationOptions;
  }) {
    vectorStore.connectEmbeddings(embeddings);
    this._vectorStore = vectorStore;
    this.augmentationOptions = augmentationOptions;
    this.catalogApi = catalogApi;
    this.logger = logger;
    this.auth = auth;
    this.discovery = discovery;
  }

  get vectorStore() {
    return this._vectorStore;
  }

  /**
   * Returns the text splitter used for catalog and TechDocs content.
   *
   * The default implementation uses a generic {@link RecursiveCharacterTextSplitter},
   * which is intentionally conservative but may not be ideal for structured data.
   * Subclasses can override this method to provide source-specific chunking.
   *
   * @returns The splitter object.
   */
  protected getSplitter() {
    return new RecursiveCharacterTextSplitter({
      chunkSize: this.augmentationOptions?.chunkSize,
      chunkOverlap: this.augmentationOptions?.chunkOverlap,
    });
  }

  /**
   * Converts catalog entities into embedding documents with entity metadata.
   */
  protected async constructCatalogEmbeddingDocuments(
    entities: Entity[],
    source: EmbeddingsSource,
  ): Promise<EmbeddingDoc[]> {
    const splitter = this.getSplitter();
    let docs: EmbeddingDoc[] = [];
    for (const entity of entities) {
      const splits = await splitter.splitText(JSON.stringify(entity));
      docs = docs.concat(
        splits.map((text: string, idx: number) => ({
          content: text,
          metadata: {
            splitId: idx.toString(),
            source,
            entityRef: stringifyEntityRef(entity),
            kind: entity.kind,
          },
        })),
      );
    }

    return docs;
  }

  /**
   * Converts TechDocs search-index sections into embedding documents with entity and page metadata.
   */
  protected async constructTechDocsEmbeddingDocuments(
    documents: TechDocsDocument[],
    source: EmbeddingsSource,
  ): Promise<EmbeddingDoc[]> {
    const splitter = this.getSplitter();
    let docs: EmbeddingDoc[] = [];
    for (const { text, entity, title, location } of documents) {
      const splits = await splitter.splitText(text);
      docs = docs.concat(
        splits.map((content: string, idx: number) => ({
          content,
          metadata: {
            splitId: idx.toString(),
            source,
            entityRef: stringifyEntityRef(entity),
            kind: entity.kind,
            title,
            location,
          },
        })),
      );
    }

    return docs;
  }

  /**
   * Loads and chunks documents for the requested supported source.
   *
   * @throws Error when the source is not supported by this default indexer.
   */
  protected async getDocuments(
    source: EmbeddingsSource,
    filter?: EntityFilterShape,
  ) {
    this.assertSupportedSource(source);
    const limit = pLimit(this.augmentationOptions?.concurrencyLimit ?? 10);

    switch (source) {
      case 'catalog': {
        const { token } = await this.auth.getPluginRequestToken({
          onBehalfOf: await this.auth.getOwnServiceCredentials(),
          targetPluginId: 'catalog',
        });

        const entitiesResponse = await this.catalogApi.getEntities(
          { filter },
          { token },
        );

        const constructCatalogEmbeddingDocuments =
          await this.constructCatalogEmbeddingDocuments(
            entitiesResponse.items,
            source,
          );
        this.logger.info(
          `Constructed ${constructCatalogEmbeddingDocuments.length} embedding documents for ${entitiesResponse.items.length} catalog items.`,
        );
        return constructCatalogEmbeddingDocuments;
      }
      case 'tech-docs': {
        const { token } = await this.auth.getPluginRequestToken({
          onBehalfOf: await this.auth.getOwnServiceCredentials(),
          targetPluginId: 'catalog',
        });

        const entitiesResponse = await this.catalogApi.getEntities(
          {
            filter: { ...TECHDOCS_ENTITY_FILTER, ...filter },
          },
          { token },
        );

        const techDocsBaseUrl = await this.discovery.getBaseUrl('techdocs');

        const documentsPromises = entitiesResponse.items.map(entity =>
          limit(async () => {
            const { kind } = entity;
            const { namespace = 'default', name } = entity.metadata;

            const searchIndexUrl = `${techDocsBaseUrl}/static/docs/${namespace}/${kind}/${name}/search/search_index.json`;

            try {
              const { token: techDocsToken } =
                await this.auth.getPluginRequestToken({
                  onBehalfOf: await this.auth.getOwnServiceCredentials(),
                  targetPluginId: 'techdocs',
                });

              const searchIndexResponse = await fetch(searchIndexUrl, {
                headers: {
                  Authorization: `Bearer ${techDocsToken}`,
                },
              });

              const searchIndex =
                (await searchIndexResponse.json()) as SearchIndex;

              return searchIndex.docs.reduce<TechDocsDocument[]>((acc, doc) => {
                // only filter sections that contain text
                if (doc.location.includes('#') && doc.text)
                  acc.push({
                    ...doc,
                    entity,
                  });

                return acc;
              }, []);
            } catch (e) {
              this.logger.debug(
                `Failed to retrieve tech docs search index for entity ${namespace}/${kind}/${name}`,
                e as Error,
              );
              return [];
            }
          }),
        );

        const documents = (await Promise.all(documentsPromises)).flat();

        const constructTechDocsEmbeddingDocuments =
          await this.constructTechDocsEmbeddingDocuments(documents, source);

        this.logger.info(
          `Constructed ${constructTechDocsEmbeddingDocuments.length} embedding documents for ${entitiesResponse.items.length} TechDocs.`,
        );
        return constructTechDocsEmbeddingDocuments;
      }
      default:
        this.logger.warn(
          `Attempted to create embeddings for unsupported source '${source}'.`,
        );
        throw new Error(
          `Attempting to create embeddings for a source not implemented yet: ${source}`,
        );
    }
  }

  /**
   * Replaces embeddings for a supported source and returns the number of documents indexed.
   */
  async createEmbeddings(
    source: EmbeddingsSource,
    filter: EntityFilterShape,
  ): Promise<number> {
    this.assertSupportedSource(source);
    await this.deleteEmbeddings(source, filter);
    const documents = await this.getDocuments(source, filter);
    await this._vectorStore.addDocuments(documents);
    return documents.length;
  }

  /**
   * Deletes vector documents for entities matching the source and optional filter.
   */
  async deleteEmbeddings(
    source: EmbeddingsSource,
    filter: EntityFilterShape,
  ): Promise<void> {
    this.assertSupportedSource(source);
    const { token } = await this.auth.getPluginRequestToken({
      onBehalfOf: await this.auth.getOwnServiceCredentials(),
      targetPluginId: 'catalog',
    });

    const entityFilter =
      source === 'tech-docs'
        ? { ...TECHDOCS_ENTITY_FILTER, ...filter }
        : filter;
    const entities = (
      await this.catalogApi.getEntities({ filter: entityFilter }, { token })
    ).items.map(stringifyEntityRef);

    for (const entityRef of entities) {
      await this._vectorStore.deleteDocuments({
        filter: { source, entityRef },
      });
    }
  }

  private assertSupportedSource(source: EmbeddingsSource): void {
    if (SUPPORTED_EMBEDDING_SOURCES.has(source)) {
      return;
    }

    this.logger.warn(
      `Attempted to create embeddings for unsupported source '${source}'.`,
    );
    throw new Error(
      `Attempting to create embeddings for a source not implemented yet: ${source}`,
    );
  }
}

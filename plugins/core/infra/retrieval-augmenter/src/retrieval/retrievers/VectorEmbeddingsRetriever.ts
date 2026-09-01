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
import { LoggerService } from '@backstage/backend-plugin-api';
import {
  AugmentationRetriever,
  EmbeddingDoc,
  EmbeddingsSource,
  EntityFilterShape,
  EmbeddingDocMetadata,
  VectorStore,
} from '@webstackbuilders/plugin-ai-core-node';

/**
 * Retriever backed by the configured vector store.
 *
 * The retriever performs semantic similarity search over previously indexed
 * embedding documents and returns the documents that should be used as grounding
 * context for an agent run. Source-specific lookups are constrained by document
 * metadata, while the special `all` source searches across every indexed source.
 */
export class VectorEmbeddingsRetriever implements AugmentationRetriever {
  private readonly logger: LoggerService;
  private readonly vectorStore: VectorStore;

  /**
   * Creates a vector-store retriever.
   */
  constructor({
    vectorStore,
    logger,
  }: {
    /** Vector store used to execute semantic similarity searches. */
    vectorStore: VectorStore;
    /** Logger used for retrieval diagnostics and vector-store failures. */
    logger: LoggerService;
  }) {
    this.vectorStore = vectorStore;
    this.logger = logger;
  }

  /** Stable retriever identifier used by routers and diagnostics. */
  public get id() {
    return 'VectorEmbeddingsRetriever';
  }

  /**
   * Retrieves embedding documents similar to the supplied query.
   *
   * The current vector-store contract accepts metadata filters, so this retriever
   * applies source filtering directly and leaves entity-level filtering to the
   * indexing stage or a future metadata-normalization layer.
   *
   * @throws Re-throws vector-store errors after logging source and query context.
   */
  async retrieve(
    query: string,
    source: EmbeddingsSource,
    _filter?: EntityFilterShape,
  ): Promise<EmbeddingDoc[]> {
    const filter: EmbeddingDocMetadata | undefined =
      source === 'all' ? undefined : { source };

    let embeddings: EmbeddingDoc[];
    try {
      embeddings = await this.vectorStore.similaritySearch(query, filter);
    } catch (error) {
      this.logger.error(
        `Vector embeddings retrieval failed for source '${source}': ${this.getErrorMessage(error)}`,
      );
      throw error;
    }

    this.logger.info(
      `Received ${embeddings.length} embeddings from Vector store`,
    );
    return embeddings;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (typeof error === 'string' && error.length > 0) {
      return error;
    }
    return 'Unknown error';
  }
}

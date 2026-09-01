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
  EmbeddingsSource,
  RetrievalRouter,
} from '@webstackbuilders/plugin-ai-core-node';

/**
 * Routes retrieval requests to the retrievers configured for a specific source.
 *
 * This router is intentionally deterministic: it does not inspect the query text
 * or score retrievers dynamically. Instead, the source supplied by the caller is
 * treated as the routing key, which keeps source ownership explicit and makes it
 * easy for backend modules to register different retrieval strategies for
 * catalog, TechDocs, or custom knowledge sources.
 *
 * Unsupported sources are logged and rejected so configuration gaps fail loudly
 * instead of silently returning no augmentation context.
 */
export class SourceBasedRetrievalRouter implements RetrievalRouter {
  private readonly logger: LoggerService;
  private readonly retrievers: Map<EmbeddingsSource, AugmentationRetriever[]>;

  /**
   * Creates a router backed by a source-to-retriever map.
   */
  constructor({
    logger,
    retrievers,
  }: {
    /** Logger used to report unsupported source lookups. */
    logger: LoggerService;
    /** Mapping from source ID to the retrievers that should handle that source. */
    retrievers: Map<EmbeddingsSource, AugmentationRetriever[]>;
  }) {
    this.retrievers = retrievers;
    this.logger = logger;
  }

  /**
   * Returns retrievers configured for the requested source.
   *
   * The current implementation ignores query text because routing is source
   * based. Query-aware routing can be introduced through another
   * {@link RetrievalRouter} implementation without changing pipeline callers.
   *
   * @throws Error when the source has no configured retrievers.
   */
  async determineRetriever(
    _query: string,
    source: EmbeddingsSource,
  ): Promise<AugmentationRetriever[]> {
    if (this.retrievers.has(source)) {
      return this.retrievers.get(source)!;
    }

    this.logger.warn(
      `Attempted to determine augmentation retriever for a source not implemented yet: ${source}`,
    );
    throw new Error(
      `Attempting to determine augmentation retriever for a source not implemented yet: ${source}`,
    );
  }
}

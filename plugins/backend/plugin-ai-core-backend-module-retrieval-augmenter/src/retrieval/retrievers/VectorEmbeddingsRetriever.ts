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
  VectorStore,
} from '@webstackbuilders/plugin-ai-core-node';

export class VectorEmbeddingsRetriever implements AugmentationRetriever {
  private readonly logger: LoggerService;
  private readonly vectorStore: VectorStore;

  constructor({
    vectorStore,
    logger,
  }: {
    vectorStore: VectorStore;
    logger: LoggerService;
  }) {
    this.vectorStore = vectorStore;
    this.logger = logger;
  }

  public get id() {
    return 'VectorEmbeddingsRetriever';
  }

  async retrieve(
    query: string,
    source: EmbeddingsSource,
    _filter?: EntityFilterShape,
  ): Promise<EmbeddingDoc[]> {
    const embeddings = await this.vectorStore.similaritySearch(query, {
      source: source !== 'all' ? source : undefined,
    });

    this.logger.info(
      `Received ${embeddings.length} embeddings from Vector store`,
    );
    return embeddings;
  }
}

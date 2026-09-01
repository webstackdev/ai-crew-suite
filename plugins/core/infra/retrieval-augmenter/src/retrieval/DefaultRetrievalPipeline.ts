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

import {
  AugmentationPostProcessor,
  AugmentationRetriever,
  EmbeddingDoc,
  EmbeddingsSource,
  EntityFilterShape,
  RetrievalPipeline,
  RetrievalRouter,
} from '@webstackbuilders/plugin-ai-core-node';
import { CombiningPostProcessor } from './postProcessors/CombiningPostProcessor';

/**
 * Default retrieval pipeline that routes a query, executes retrievers, and post-processes results.
 *
 * The pipeline executes direct retrievers first, then retrievers returned by each
 * router in router order. Retriever outputs are grouped by retriever ID before
 * being passed to post-processors. If multiple retrievers share an ID, their
 * documents are merged instead of overwritten so context is not silently lost.
 *
 * This class does not own logging because routing, retrieval, and post-processing
 * implementations have the domain context needed for useful messages. Errors
 * from routers, retrievers, and post-processors intentionally propagate to the
 * caller so higher-level orchestration can decide whether to retry, fall back, or fail.
 */
export class DefaultRetrievalPipeline implements RetrievalPipeline {
  private readonly routers: RetrievalRouter[];
  private readonly retrievers: AugmentationRetriever[];
  private readonly postProcessors: AugmentationPostProcessor[];

  /**
   * Creates a retrieval pipeline from optional routers, direct retrievers, and post-processors.
   */
  constructor({
    routers,
    retrievers,
    postProcessors,
  }: {
    /** Routers that dynamically select retrievers for a query/source pair. */
    routers?: RetrievalRouter[];
    /** Retrievers that should always execute for every query/source pair. */
    retrievers?: AugmentationRetriever[];
    /** Post-processors that transform retriever outputs into final context. */
    postProcessors?: AugmentationPostProcessor[];
  }) {
    this.routers = routers ?? [];
    this.retrievers = retrievers ?? [];
    this.postProcessors = postProcessors ?? [new CombiningPostProcessor()];
  }

  /**
   * Retrieves augmentation documents for a query/source pair.
   *
   * The optional filter is forwarded to every retriever. Each post-processor
   * receives the same grouped retriever output map, and all post-processor
   * outputs are flattened into the final context array.
   */
  async retrieveAugmentationContext(
    query: string,
    source: EmbeddingsSource,
    filter?: EntityFilterShape,
  ): Promise<EmbeddingDoc[]> {
    const routedRetrievers = (
      await Promise.all(
        this.routers.map(router => router.determineRetriever(query, source)),
      )
    ).flat();
    const augmentations: Map<string, EmbeddingDoc[]> = new Map();
    for (const retriever of [...this.retrievers, ...routedRetrievers]) {
      const documents = await retriever.retrieve(query, source, filter);
      augmentations.set(retriever.id, [
        ...(augmentations.get(retriever.id) ?? []),
        ...documents,
      ]);
    }

    return (
      await Promise.all(
        this.postProcessors.map(postProcessor =>
          postProcessor.process(query, source, augmentations),
        ),
      )
    ).flat();
  }
}

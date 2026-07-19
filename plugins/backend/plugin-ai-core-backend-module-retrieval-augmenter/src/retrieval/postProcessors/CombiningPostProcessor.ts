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
  EmbeddingDoc,
  EmbeddingsSource,
} from '@webstackbuilders/plugin-ai-core-node';

/**
 * Post-processor that concatenates retriever results into one context list.
 *
 * The processor preserves the insertion order of the retriever result map and
 * the order of documents within each retriever's result array. It does not rank,
 * deduplicate, filter, or log because it performs no fallible I/O and is meant
 * to be the minimal default combiner for retrieval pipelines.
 */
export class CombiningPostProcessor implements AugmentationPostProcessor {
  /**
   * Flattens retriever results into the final ordered augmentation context.
   */
  async process(
    _query: string,
    _source: EmbeddingsSource,
    embeddingDocs: Map<string, EmbeddingDoc[]>,
  ): Promise<EmbeddingDoc[]> {
    return Array.from(embeddingDocs.values()).flat();
  }
}

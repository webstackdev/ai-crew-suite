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

import { EmbeddingsSource, EntityFilterShape, EmbeddingDocMetadata } from './source';
import { VectorStore } from './vector';

/**
 * Text document returned from retrieval and passed to language-model prompts.
 */
export type EmbeddingDoc = {
  /** Metadata used to identify and filter the retrieved document. */
  metadata: EmbeddingDocMetadata;
  /** Retrieved document text that can be included as grounding context. */
  content: string;
};

/**
 * Creates and removes embeddings for a content source.
 */
export interface AugmentationIndexer {
  /** Vector store used by the indexer to persist generated embedding documents. */
  vectorStore: VectorStore;
  /**
   * Generates embeddings for documents from the source and returns the number
   * of embedded documents written to the vector store.
   */
  createEmbeddings(
    source: EmbeddingsSource,
    filter?: EntityFilterShape,
  ): Promise<number>;
  /** Removes embeddings for the source and optional entity/document filter. */
  deleteEmbeddings(
    source: EmbeddingsSource,
    filter: EntityFilterShape,
  ): Promise<void>;
}

/**
 * Selects one or more retrievers that should handle a query for a source.
 */
export interface RetrievalRouter {
  /** Returns the retrievers to execute for the supplied query and source. */
  determineRetriever(
    query: string,
    source: EmbeddingsSource,
  ): Promise<AugmentationRetriever[]>;
}

/**
 * Retrieves grounding documents for a query from a source-specific backend.
 */
export interface AugmentationRetriever {
  /** Unique retriever identifier used for diagnostics and result grouping. */
  id: string;
  /** Returns documents relevant to the query, source, and optional filter. */
  retrieve(
    query: string,
    source: EmbeddingsSource,
    filter?: EntityFilterShape,
  ): Promise<EmbeddingDoc[]>;
}

/**
 * Combines, ranks, filters, or otherwise transforms retriever outputs.
 */
export interface AugmentationPostProcessor {
  /** Produces the final retrieval context from retriever results keyed by retriever ID. */
  process(
    query: string,
    source: EmbeddingsSource,
    embeddingDocs: Map<string, EmbeddingDoc[]>,
  ): Promise<EmbeddingDoc[]>;
}

/**
 * End-to-end retrieval pipeline used by tools and controllers to gather context.
 */
export interface RetrievalPipeline {
  /** Returns documents that should be supplied to an agent as augmentation context. */
  retrieveAugmentationContext(
    query: string,
    source: EmbeddingsSource,
    filter?: EntityFilterShape,
  ): Promise<EmbeddingDoc[]>;
}

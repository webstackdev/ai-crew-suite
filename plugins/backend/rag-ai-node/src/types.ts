/*
 * Copyright 2024 Larder Software Limited
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
import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseLLM } from '@langchain/core/language_models/llms';

export type SourceId = string;

export type EmbeddingsSource = SourceId;

export type SourceDescriptor = {
  id: SourceId;
  description?: string;
};

export interface SourceRegistry {
  register(source: SourceDescriptor): void;
  list(): SourceDescriptor[];
  has(id: SourceId): boolean;
}

export type EmbeddingDocMetadata = Partial<{
  source: EmbeddingsSource;
  [key: string]: string;
}>;

export type EntityFilterShape =
  | Record<string, string | symbol | (string | symbol)[]>[]
  | Record<string, string | symbol | (string | symbol)[]>
  | undefined;

export type Embedding = {
  metadata: EmbeddingDocMetadata;
  content: string;
  vector: number[];
  id: string;
};

export type EmbeddingDoc = {
  metadata: EmbeddingDocMetadata;
  content: string;
};

export interface AugmentationIndexer {
  vectorStore: VectorStore;
  createEmbeddings(
    source: EmbeddingsSource,
    filter?: EntityFilterShape,
  ): Promise<number>;
  deleteEmbeddings(
    source: EmbeddingsSource,
    filter: EntityFilterShape,
  ): Promise<void>;
}

export interface RetrievalRouter {
  determineRetriever(
    query: string,
    source: EmbeddingsSource,
  ): Promise<AugmentationRetriever[]>;
}

export interface AugmentationRetriever {
  id: string;
  retrieve(
    query: string,
    source: EmbeddingsSource,
    filter?: EntityFilterShape,
  ): Promise<EmbeddingDoc[]>;
}

export interface AugmentationPostProcessor {
  process(
    query: string,
    source: EmbeddingsSource,
    embeddingDocs: Map<string, EmbeddingDoc[]>,
  ): Promise<EmbeddingDoc[]>;
}

export interface RetrievalPipeline {
  retrieveAugmentationContext(
    query: string,
    source: EmbeddingsSource,
    filter?: EntityFilterShape,
  ): Promise<EmbeddingDoc[]>;
}

type DeletionParams = {
  ids?: string[];
  filter?: EmbeddingDocMetadata;
};

export interface VectorStore {
  connectEmbeddings(embeddings: Embeddings): void;
  addDocuments(docs: EmbeddingDoc[]): Promise<void>;
  deleteDocuments(deletionParams: DeletionParams): Promise<void>;
  similaritySearch(
    query: string,
    filter?: EmbeddingDocMetadata,
    amount?: number,
  ): Promise<EmbeddingDoc[]>;
}

export type ModelDefinition = {
  id: string;
  model: BaseLLM | BaseChatModel;
};

export type ToolDefinition = {
  id: string;
  augmentationIndexer?: AugmentationIndexer;
  retrievalPipeline?: RetrievalPipeline;
};

export type TriggerBinding = {
  id: string;
  source?: string;
};

export type AgentDefinition = {
  id: string;
  modelRef: string;
  systemPrompt: string;
  toolIds: string[];
  orchestrator?: 'single-shot' | 'langgraph' | 'crew';
  memory?: 'none' | 'session';
  triggers?: TriggerBinding[];
};

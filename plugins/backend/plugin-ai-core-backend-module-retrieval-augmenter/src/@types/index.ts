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
import type { CatalogApi } from '@backstage/catalog-client';
import type {
  AuthService,
  DiscoveryService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import type { Entity } from '@backstage/catalog-model';
import type { VectorStore } from '@webstackbuilders/plugin-ai-core-node';

export type AugmentationOptions = {
  chunkSize?: number;
  chunkOverlap?: number;
  concurrencyLimit?: number;
};

/**
 * Core environment configuration contract for calculating and registering vector embeddings.
 */
export interface EmbeddingsConfig {
  /** Centralized logging runtime infrastructure. */
  logger: LoggerService;
  /** Backstage auth service used to request plugin-to-plugin access tokens. */
  auth: AuthService;
  /** Vector abstraction storage engine mapping directly to your pgvector database module. */
  vectorStore: VectorStore;
  /** External catalog proxy interface client. */
  catalogApi: CatalogApi;
  /** Backstage discovery service used to resolve plugin base URLs. */
  discovery: DiscoveryService;
  /** Slicing and overlap configuration tuning bounds for ingestion payloads. */
  augmentationOptions?: AugmentationOptions;
}

export type SearchIndex = {
  config: {
    indexing: string;
    lang: string[];
    min_search_length: number;
    prebuild_index: boolean;
    separator: string;
  };
  docs: {
    location: string;
    text: string;
    title: string;
  }[];
};

export type TechDocsDocument = {
  text: string;
  entity: Entity;
  title: string;
  location: string;
};

/**
 * Instantiation blueprint options utilized by the default context retrieval pipeline.
 */
export type DefaultRetrievalPipelineOptions = {
  /** Active vector store database instance wrapper. */
  vectorStore: VectorStore;
  /** Centralized logging runtime infrastructure. */
  logger: LoggerService;
  /** Backstage discovery service used to resolve plugin base URLs. */
  discovery: DiscoveryService;
  /** Backstage auth service used to request plugin-to-plugin access tokens. */
  auth: AuthService;
};


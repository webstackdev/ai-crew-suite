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
  DefaultRetrievalPipeline,
  SearchRetriever,
  SourceBasedRetrievalRouter,
  VectorEmbeddingsRetriever,
} from './retrieval';
import type { DefaultRetrievalPipelineOptions } from './@types';

/**
 * Creates the standard retrieval pipeline used by the AI core backend module.
 *
 * The default pipeline combines semantic vector retrieval with Backstage Search
 * retrieval for `catalog`, `tech-docs`, and `all` sources. Component-level
 * logging and error handling live in the retrievers, router, and search client;
 * this factory only composes those pieces with the Backstage services they need.
 */
export const createDefaultRetrievalPipeline = ({
  vectorStore,
  discovery,
  logger,
  auth,
}: DefaultRetrievalPipelineOptions) => {
  const vectorEmbeddingsRetriever = new VectorEmbeddingsRetriever({
    vectorStore: vectorStore,
    logger,
  });

  const searchRetriever = new SearchRetriever({
    discovery,
    logger,
    auth,
  });

  const sourceBasedRetrieverConfig = new Map();
  ['catalog', 'tech-docs', 'all'].forEach(source => {
    sourceBasedRetrieverConfig.set(source, [
      vectorEmbeddingsRetriever,
      searchRetriever,
    ]);
  });

  const retrievalRouters = [
    new SourceBasedRetrievalRouter({
      logger,
      retrievers: sourceBasedRetrieverConfig,
    }),
  ];

  return new DefaultRetrievalPipeline({
    routers: retrievalRouters,
  });
};

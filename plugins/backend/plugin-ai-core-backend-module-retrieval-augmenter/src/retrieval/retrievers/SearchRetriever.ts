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
  AuthService,
  DiscoveryService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import {
  AugmentationRetriever,
  EmbeddingDoc,
  EmbeddingsSource,
} from '@webstackbuilders/plugin-ai-core-node';
import { SearchClient } from './SearchClient';

/**
 * Retrieves augmentation documents from the Backstage Search plugin.
 *
 * This retriever adapts the generic {@link AugmentationRetriever} contract to
 * Backstage Search. It delegates HTTP/auth details to {@link SearchClient}, then
 * records a source-specific result count for operational visibility. It does not
 * catch client failures; those are logged by the client and allowed to propagate
 * so the retrieval pipeline can decide whether to fail or fall back.
 */
export class SearchRetriever implements AugmentationRetriever {
  private readonly searchClient: SearchClient;
  private readonly logger: LoggerService;

  constructor({
    discovery,
    logger,
    searchClient,
    auth,
  }: {
    /** Discovery service used by the default search client to locate the search plugin. */
    discovery: DiscoveryService;
    /** Logger used for retriever-level result telemetry. */
    logger: LoggerService;
    /** Optional client override, primarily useful for tests or custom search clients. */
    searchClient?: SearchClient;
    /** Auth service used by the default search client for plugin-to-plugin tokens. */
    auth: AuthService;
  }) {
    this.searchClient =
      searchClient ??
      new SearchClient({
        discoveryApi: discovery,
        logger: logger.child({ label: 'ai-core-search-client' }),
        auth,
      });
    this.logger = logger;
  }

  /** Stable retriever identifier used by retrieval routers and diagnostics. */
  public get id(): string {
    return 'SearchRetriever';
  }

  /**
   * Queries Backstage Search for embedding documents that match the query/source pair.
   */
  public async retrieve(
    query: string,
    source: EmbeddingsSource,
  ): Promise<EmbeddingDoc[]> {
    const queryResults = await this.searchClient.query({
      term: query,
      source: source,
    });

    this.logger.info(
      `Received ${queryResults.length} results when querying augmentations from search for source '${source}'.`,
    );

    return queryResults;
  }
}

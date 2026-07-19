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
  LoggerService
} from '@backstage/backend-plugin-api';
import {
  AugmentationRetriever,
  EmbeddingDoc,
  EmbeddingsSource,
} from '@webstackbuilders/plugin-ai-core-node';
import { SearchClient } from './SearchClient';

/**
 * Context retriever that extracts relevant engineering documents from the Backstage Search Engine.
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
    /** Modern Backstage endpoint discovery service token. */
    discovery: DiscoveryService;
    /** Centralized logging runtime infrastructure. */
    logger: LoggerService;
    /** Optional explicit instance override for underlying search clients. */
    searchClient?: SearchClient;
    /** Modern Backstage auth engine supporting service-to-service credentials validation tokens. */
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

  /** Unified identifier string mapping this retriever to target engine registries. */
  public get id(): string {
    return 'SearchRetriever';
  }

  /**
   * Queries the unified index cluster and compiles matching text schemas down to retrieval arrays.
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
      `Received ${queryResults.length} results when querying augmentations from search.`,
    );

    return queryResults;
  }
}

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
import { ResponseError } from '@backstage/errors';
import { SearchResultSet } from '@backstage/plugin-search-common';
import {
  EmbeddingDoc,
  EmbeddingsSource,
} from '@webstackbuilders/plugin-ai-core-node';

/**
 * Query sent to the Backstage search API for augmentation documents.
 */
export type SearchClientQuery = {
  /** Natural-language search term supplied by the retriever. */
  term: string;
  /** AI source used to select the matching Backstage search document type. */
  source: EmbeddingsSource;
};

const embeddingsSourceToBackstageSearchType = (source: EmbeddingsSource) => {
  switch (source) {
    case 'catalog':
      return 'software-catalog';
    case 'tech-docs':
      return 'techdocs';
    case 'all':
      return undefined;
    default:
      return 'software-catalog';
  }
};

/**
 * Thin Backstage Search API client used by retrieval pipelines.
 *
 * The client translates AI source IDs into Backstage search document types,
 * obtains a service-to-service token through {@link AuthService}, and maps
 * search results into augmentation documents. Non-OK search responses are logged
 * and treated as empty retrieval results so the vector retriever can still
 * contribute context; unexpected transport/auth failures are logged and rethrown
 * for the caller to handle.
 */
export class SearchClient {
  private readonly discoveryApi: DiscoveryService;
  private readonly logger: LoggerService;
  private readonly auth: AuthService;

  /**
   * Creates a search client using Backstage discovery and auth services.
   */
  constructor(options: {
    /** Discovery service used to resolve the search plugin base URL. */
    discoveryApi: DiscoveryService;
    /** Logger used for search API warnings and failures. */
    logger: LoggerService;
    /** Auth service used to request plugin-to-plugin tokens for the search API. */
    auth: AuthService;
  }) {
    this.discoveryApi = options.discoveryApi;
    this.logger = options.logger;
    this.auth = options.auth;
  }

  /**
   * Queries Backstage Search and converts matching documents into embedding docs.
   */
  async query(query: SearchClientQuery): Promise<EmbeddingDoc[]> {
    try {
      const url = await this.buildSearchUrl(query);

      const { token } = await this.auth.getPluginRequestToken({
        onBehalfOf: await this.auth.getOwnServiceCredentials(),
        targetPluginId: 'search',
      });

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        this.logger.warn(
          'Unable to query Backstage search API for embeddable results.',
          await ResponseError.fromResponse(response),
        );
        return [];
      }

      const searchResults = (await response.json()) as SearchResultSet;

      return (
        searchResults.results?.map(searchResult => ({
          metadata: {
            source: query.source,
            location: searchResult.document.location,
          },
          content: searchResult.document.text,
        })) ?? []
      );
    } catch (error) {
      this.logger.warn(
        `Unable to query Backstage search API for source '${query.source}'.`,
        error,
      );
      throw error;
    }
  }

  private async buildSearchUrl(query: SearchClientQuery): Promise<string> {
    const searchBaseUrl = await this.discoveryApi.getBaseUrl('search');
    const searchUrl = new URL(`${searchBaseUrl.replace(/\/$/, '')}/query`);
    searchUrl.searchParams.set('term', query.term);

    const searchType = embeddingsSourceToBackstageSearchType(query.source);
    if (searchType) {
      searchUrl.searchParams.set('types[0]', searchType);
    }

    return searchUrl.toString();
  }
}

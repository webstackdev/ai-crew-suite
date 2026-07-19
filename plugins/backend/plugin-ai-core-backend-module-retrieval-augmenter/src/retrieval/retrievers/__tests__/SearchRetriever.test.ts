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
import { describe, expect, it, vi } from 'vitest';
import type {
  AuthService,
  DiscoveryService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import { SearchClient } from '../SearchClient';
import { SearchRetriever } from '../SearchRetriever';

const createLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  child: vi.fn(() => ({ warn: vi.fn() })),
}) as unknown as LoggerService & {
  info: ReturnType<typeof vi.fn>;
  child: ReturnType<typeof vi.fn>;
};

const createDiscovery = (): DiscoveryService => ({
  getBaseUrl: vi.fn(),
}) as unknown as DiscoveryService;

const createAuth = (): AuthService => ({
  getOwnServiceCredentials: vi.fn(),
  getPluginRequestToken: vi.fn(),
}) as unknown as AuthService;

describe('SearchRetriever', () => {
  it('exposes a stable retriever id', () => {
    const retriever = new SearchRetriever({
      discovery: createDiscovery(),
      logger: createLogger(),
      searchClient: { query: vi.fn() } as unknown as SearchClient,
      auth: createAuth(),
    });

    expect(retriever.id).toBe('SearchRetriever');
  });

  it('delegates retrieval to the search client and logs the source-specific result count', async () => {
    const logger = createLogger();
    const searchResults = [
      {
        metadata: { source: 'catalog', location: 'catalog:default/component/service-a' },
        content: 'Service A docs',
      },
    ];
    const searchClient = {
      query: vi.fn().mockResolvedValue(searchResults),
    } as unknown as SearchClient;
    const retriever = new SearchRetriever({
      discovery: createDiscovery(),
      logger,
      searchClient,
      auth: createAuth(),
    });

    const results = await retriever.retrieve('service owner', 'catalog');

    expect(results).toBe(searchResults);
    expect(searchClient.query).toHaveBeenCalledWith({
      term: 'service owner',
      source: 'catalog',
    });
    expect(logger.info).toHaveBeenCalledWith(
      "Received 1 results when querying augmentations from search for source 'catalog'.",
    );
  });

  it('creates a child-scoped default search client when no client override is supplied', () => {
    const logger = createLogger();

    const retriever = new SearchRetriever({
      discovery: createDiscovery(),
      logger,
      auth: createAuth(),
    });

    expect(retriever).toBeInstanceOf(SearchRetriever);
    expect(logger.child).toHaveBeenCalledWith({ label: 'ai-core-search-client' });
  });

  it('propagates search client failures to the retrieval pipeline', async () => {
    const failure = new Error('search unavailable');
    const searchClient = {
      query: vi.fn().mockRejectedValue(failure),
    } as unknown as SearchClient;
    const retriever = new SearchRetriever({
      discovery: createDiscovery(),
      logger: createLogger(),
      searchClient,
      auth: createAuth(),
    });

    await expect(retriever.retrieve('service owner', 'catalog')).rejects.toThrow(
      'search unavailable',
    );
  });
});

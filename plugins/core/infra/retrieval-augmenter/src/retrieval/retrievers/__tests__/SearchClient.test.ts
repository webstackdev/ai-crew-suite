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
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  AuthService,
  DiscoveryService,
} from '@backstage/backend-plugin-api';
import {
  SearchClient,
  SearchClientQuery,
} from '../SearchClient';

describe('SearchClient', () => {
  let mockDiscoveryApi: DiscoveryService;
  let mockAuth: AuthService;
  let mockLogger: any;
  let searchClient: SearchClient;

  beforeEach(() => {
    mockDiscoveryApi = {
      getBaseUrl: vi.fn().mockResolvedValue('http://mock-search-url'),
    } as unknown as DiscoveryService;
    mockAuth = {
      getOwnServiceCredentials: vi.fn().mockResolvedValue({ principal: 'mock-service' }),
      getPluginRequestToken: vi.fn().mockResolvedValue({ token: 'mock-token' }),
    } as unknown as AuthService;
    mockLogger = {
      warn: vi.fn(),
    };

    searchClient = new SearchClient({
      discoveryApi: mockDiscoveryApi,
      auth: mockAuth,
      logger: mockLogger,
    });
  });

  test('should create a SearchClient with the correct constructor parameters', () => {
    expect(searchClient).toBeDefined();
    expect(searchClient).toBeInstanceOf(SearchClient);
  });

  test('sets the authorization header and maps catalog source to software catalog search type', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [] }),
    } as unknown as Response;

    const mockFetch = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(mockResponse);

    const query: SearchClientQuery = {
      term: 'owner service',
      source: 'catalog',
    };

    await searchClient.query(query);

    expect(mockDiscoveryApi.getBaseUrl).toHaveBeenCalled();
    expect(mockAuth.getOwnServiceCredentials).toHaveBeenCalled();
    expect(mockAuth.getPluginRequestToken).toHaveBeenCalledWith({
      onBehalfOf: { principal: 'mock-service' },
      targetPluginId: 'search',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://mock-search-url/query?term=owner+service&types%5B0%5D=software-catalog',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
      },
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('omits search type filters when querying all sources', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [] }),
    } as unknown as Response;
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse);

    await searchClient.query({ term: 'catalog docs', source: 'all' });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://mock-search-url/query?term=catalog+docs',
      expect.any(Object),
    );
  });

  test('maps search results into embedding documents', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: [
          {
            document: {
              location: 'catalog:component/default/service-a',
              text: 'Service A documentation',
            },
          },
        ],
      }),
    } as unknown as Response);

    const results = await searchClient.query({
      term: 'service a',
      source: 'catalog',
    });

    expect(results).toEqual([
      {
        metadata: {
          source: 'catalog',
          location: 'catalog:component/default/service-a',
        },
        content: 'Service A documentation',
      },
    ]);
  });

  test('logs and returns empty results for non-OK search responses', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: vi.fn().mockResolvedValue('search unavailable'),
      headers: new Headers(),
    } as unknown as Response);

    const results = await searchClient.query({
      term: 'service a',
      source: 'catalog',
    });

    expect(results).toEqual([]);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Unable to query Backstage search API for embeddable results.',
      expect.any(Error),
    );
  });

  test('logs and rethrows unexpected search failures', async () => {
    const failure = new Error('network unavailable');
    vi.spyOn(global, 'fetch').mockRejectedValue(failure);

    await expect(
      searchClient.query({ term: 'service a', source: 'catalog' }),
    ).rejects.toThrow('network unavailable');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Unable to query Backstage search API for source 'catalog'.",
      failure,
    );
  });
});

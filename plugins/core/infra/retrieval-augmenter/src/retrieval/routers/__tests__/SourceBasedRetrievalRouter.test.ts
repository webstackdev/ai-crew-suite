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
  AugmentationRetriever,
  EmbeddingsSource,
} from '@webstackbuilders/plugin-ai-core-node';
import { SourceBasedRetrievalRouter } from '../SourceBasedRetrievalRouter';

const createLogger = () => ({
  warn: vi.fn(),
});

const createRetriever = (id: string): AugmentationRetriever => ({
  id,
  retrieve: vi.fn(async () => []),
});

describe('SourceBasedRetrievalRouter', () => {
  it('returns retrievers registered for the requested source', async () => {
    const logger = createLogger();
    const catalogRetrievers = [createRetriever('catalog-vector')];
    const techDocsRetrievers = [createRetriever('techdocs-vector')];
    const router = new SourceBasedRetrievalRouter({
      logger: logger as any,
      retrievers: new Map<EmbeddingsSource, AugmentationRetriever[]>([
        ['catalog', catalogRetrievers],
        ['tech-docs', techDocsRetrievers],
      ]),
    });

    await expect(
      router.determineRetriever('who owns this service?', 'catalog'),
    ).resolves.toBe(catalogRetrievers);

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns and throws when no retrievers are registered for the source', async () => {
    const logger = createLogger();
    const router = new SourceBasedRetrievalRouter({
      logger: logger as any,
      retrievers: new Map<EmbeddingsSource, AugmentationRetriever[]>([
        ['catalog', [createRetriever('catalog-vector')]],
      ]),
    });

    await expect(
      router.determineRetriever('find deployment docs', 'tech-docs'),
    ).rejects.toThrow(
      'Attempting to determine augmentation retriever for a source not implemented yet: tech-docs',
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Attempted to determine augmentation retriever for a source not implemented yet: tech-docs',
    );
  });
});

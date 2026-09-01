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
import { describe, expect, it } from 'vitest';
import type { EmbeddingDoc } from '@webstackbuilders/plugin-ai-core-node';
import { CombiningPostProcessor } from '../CombiningPostProcessor';

const doc = (content: string): EmbeddingDoc => ({
  content,
  metadata: { source: 'catalog' },
});

describe('CombiningPostProcessor', () => {
  it('flattens retriever results in map insertion order', async () => {
    const processor = new CombiningPostProcessor();
    const retrieverResults = new Map<string, EmbeddingDoc[]>([
      ['vector', [doc('vector-1'), doc('vector-2')]],
      ['search', [doc('search-1')]],
    ]);

    const results = await processor.process(
      'service owner',
      'catalog',
      retrieverResults,
    );

    expect(results).toEqual([
      doc('vector-1'),
      doc('vector-2'),
      doc('search-1'),
    ]);
  });

  it('returns an empty context list when no retriever produced documents', async () => {
    const processor = new CombiningPostProcessor();

    await expect(
      processor.process('service owner', 'catalog', new Map()),
    ).resolves.toEqual([]);
  });
});

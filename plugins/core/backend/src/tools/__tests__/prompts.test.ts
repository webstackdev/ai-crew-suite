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
import { createPromptTemplates } from '../prompts';

describe('createPromptTemplates', () => {
  it('uses grounded default prefix instructions with embedded context', () => {
    const templates = createPromptTemplates();

    const prompt = templates.prefixPrompt('catalog-info.yaml contains owner: platform');

    expect(prompt).toContain('answer questions from documents');
    expect(prompt).toContain("return I don't know");
    expect(prompt).toContain('Only use information provided by the embedded documentation');
    expect(prompt).toContain(
      'The embedded input document you should use to answer this query is the following: catalog-info.yaml contains owner: platform',
    );
  });

  it('uses default suffix question framing with the user query', () => {
    const templates = createPromptTemplates();

    const prompt = templates.suffixPrompt('Who owns this service?');

    expect(prompt).toContain('Begin!');
    expect(prompt).toContain('Question: Who owns this service?');
  });

  it('uses configured prefix without default grounding instructions', () => {
    const templates = createPromptTemplates({
      prefix: 'Use this curated context:',
    });

    const prompt = templates.prefixPrompt('service metadata');

    expect(prompt).toBe('Use this curated context:  service metadata');
    expect(prompt).not.toContain('answer questions from documents');
  });

  it('uses configured suffix without default question framing', () => {
    const templates = createPromptTemplates({
      suffix: 'Respond to:',
    });

    const prompt = templates.suffixPrompt('List dependencies');

    expect(prompt).toBe('Respond to: List dependencies');
    expect(prompt).not.toContain('Question:');
  });

  it('applies partial prompt overrides independently', () => {
    const templates = createPromptTemplates({
      prefix: 'Context block:',
    });

    expect(templates.prefixPrompt('docs')).toBe('Context block:  docs');
    expect(templates.suffixPrompt('What changed?')).toContain('Question: What changed?');
  });
});
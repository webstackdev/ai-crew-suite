/**
 * Copyright 2026 The AI Crew Suite Authors
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
import { describe, it, expect } from 'vitest';
import { createFlatConfigForRole } from '../index.js';

describe('config-eslint factory', () => {
  it('should generate a valid array format for Flat Config rulesets', () => {
    const config = createFlatConfigForRole('backend-plugin');

    expect(Array.isArray(config)).toBe(true);
    expect(config.length).toBeGreaterThan(1);
  });

  it('should enforce specific Node environments for backend configurations', () => {
    const config = createFlatConfigForRole('backend-plugin');
    const backendBlock = config.find(block => block.rules && block.rules['new-cap']);

    expect(backendBlock).toBeDefined();
    expect(backendBlock?.languageOptions?.globals?.process).toBeDefined();
    expect(backendBlock?.rules?.['new-cap']).toEqual(['error', { capIsNew: false }]);
  });

  it('should enforce specific Browser, React, and bundle constraints for frontend configurations', () => {
    const config = createFlatConfigForRole('frontend-plugin');
    const frontendBlock = config.find(block => block.plugins && block.plugins.react);

    expect(frontendBlock).toBeDefined();
    expect(frontendBlock?.languageOptions?.globals?.window).toBeDefined();
    expect(frontendBlock?.rules?.['react/react-in-jsx-scope']).toBe('off');
    expect(frontendBlock?.rules?.['no-restricted-imports']).toBeDefined();
  });

  it('should accurately merge downstream custom overrides provided by production plugins', () => {
    const customOverride = {
      files: ['src/experimental/**/*.ts'],
      rules: { 'no-console': 'off' as const },
    };

    const config = createFlatConfigForRole('node-library', [customOverride]);
    const finalBlock = config[config.length - 1];

    expect(finalBlock).toEqual(customOverride);
  });
});

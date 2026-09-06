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
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { parseCommentedJson, findPackages } from '../sync-project-references.js';
import * as fs from 'fs';

vi.mock('fs');

describe('sync-project-references utilities', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('parseCommentedJson', () => {
    it('should strip single-line and multi-line comments safely', () => {
      const commentedJson = `
        {
          // This is a line comment
          "name": "test-package",
          /* This is a multi-line comment block
             spanning multiple rows */
          "private": true
        }
      `;
      const result = parseCommentedJson(commentedJson);
      expect(result).toEqual({ name: 'test-package', private: true });
    });
  });

  describe('findPackages', () => {
    it('should instantly parse package.json and skip deeper recursion if package.json is found', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['package.json' as any, 'src' as any]);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ name: '@ai-crew-suite/core' }));

      const packageMaps = findPackages('/root/packages/core');
      expect(packageMaps.has('@ai-crew-suite/core')).toBe(true);
      expect(fs.readFileSync).toHaveBeenCalled();
    });
  });
});

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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { findRepoRoot, getWorkspaceContext } from '../workspace.js';

describe('Workspace Context Utilities Engine', () => {
  const mockCwd = '/home/user/repo/packages/my-package';

  beforeEach(() => {
    // 💡 Lock process.cwd and cleanly spy on the native file system hooks
    vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);
    vi.spyOn(fs, 'existsSync');
    vi.spyOn(fs, 'readFileSync');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('findRepoRoot()', () => {
    it('should successfully climb the tree until it finds backstage.json', () => {
      // 💡 Permitted test-file 'any' cast
      (fs.existsSync as any).mockImplementation((targetPath: string) => {
        const normalized = targetPath.replace(/\\/g, '/');
        return normalized === '/home/user/repo/backstage.json';
      });

      const calculatedRoot = findRepoRoot(mockCwd);
      expect(calculatedRoot).toBe('/home/user/repo');
    });

    it('should fall back to start directory context if backstage.json is absent', () => {
      (fs.existsSync as any).mockReturnValue(false);

      const calculatedRoot = findRepoRoot(mockCwd);
      expect(calculatedRoot).toBe(mockCwd);
    });
  });

  describe('getWorkspaceContext()', () => {
    it('should accurately resolve browser domain criteria for frontend plugin roles', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(
        JSON.stringify({
          name: '@ai-crew-suite/my-frontend-plugin',
          backstage: { role: 'frontend-plugin' },
        })
      );

      const context = getWorkspaceContext();

      expect(context.packageName).toBe('@ai-crew-suite/my-frontend-plugin');
      expect(context.role).toBe('frontend-plugin');
      expect(context.isBrowser).toBe(true);
      expect(context.isServer).toBe(false);
    });

    it('should accurately resolve server domain criteria for standard node library roles', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(
        JSON.stringify({
          name: '@ai-crew-suite/logger',
          backstage: { role: 'node-library' },
        })
      );

      const context = getWorkspaceContext();

      expect(context.packageName).toBe('@ai-crew-suite/logger');
      expect(context.role).toBe('node-library');
      expect(context.isBrowser).toBe(false);
      expect(context.isServer).toBe(true);
    });
  });
});

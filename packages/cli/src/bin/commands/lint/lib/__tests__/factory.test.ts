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
// 📂 packages/cli/src/bin/commands/lint/lib/__tests__/factory.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFlatConfigForWorkspace } from '../factory.js';
import * as workspaceUtils from '../../../../utils/workspace.js';

vi.mock('../../../../utils/workspace.js', async () => {
  const actual = await vi.importActual<typeof import('../../../../utils/workspace.js')>('../../../../utils/workspace.js');
  return {
    ...actual,
    getWorkspaceContext: vi.fn(),
  };
});

describe('ESLint Flat Configuration Factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate browser-specific environments and rules for a frontend plugin role', () => {
    (workspaceUtils.getWorkspaceContext as any).mockReturnValue({
      packageName: '@ai-crew-suite/my-frontend-plugin',
      role: 'frontend-plugin',
      isBrowser: true,
      isServer: false,
      packageDir: '/mock/packages/my-frontend-plugin',
      repoRoot: '/mock',
    });

    const config = createFlatConfigForWorkspace() as any[];
    expect(config.length).toBeGreaterThan(2);

    const hasReactPlugin = config.some((block) => block.plugins && block.plugins['react'] !== undefined);
    const hasJsxA11yPlugin = config.some((block) => block.plugins && block.plugins['jsx-a11y'] !== undefined);

    expect(hasReactPlugin).toBe(true);
    expect(hasJsxA11yPlugin).toBe(true);
  });

  it('should generate node-specific server globals and rules for a backend plugin role', () => {
    (workspaceUtils.getWorkspaceContext as any).mockReturnValue({
      packageName: '@ai-crew-suite/plugin-scaffolder-backend',
      role: 'backend-plugin',
      isBrowser: false,
      isServer: true,
      packageDir: '/mock/plugins/scaffolder-backend',
      repoRoot: '/mock',
    });

    const config = createFlatConfigForWorkspace() as any[];

    // Verify frontend blocks are successfully skipped
    const hasReactPlugin = config.some((block) => block.plugins && block.plugins['react'] !== undefined);
    expect(hasReactPlugin).toBe(false);

    // 💡 FIXED: Search securely for a block containing a valid rules mapping dictionary
    const hasWinstonRule = config.some((block) => {
      return block && typeof block === 'object' && block['rules'] && block['rules']['no-restricted-syntax'] !== undefined;
    });

    expect(hasWinstonRule).toBe(true);
  });

  it('should properly inject custom overrides array parameters at the tail end', () => {
    (workspaceUtils.getWorkspaceContext as any).mockReturnValue({
      packageName: '@ai-crew-suite/cli',
      role: 'cli',
      isBrowser: false,
      isServer: true,
      packageDir: '/mock/packages/cli',
      repoRoot: '/mock',
    });

    const customOverrideBlock = {
      files: ['**/custom-path/*.ts'],
      rules: { 'no-eval': 'error' },
    };

    const config = createFlatConfigForWorkspace([customOverrideBlock]) as any[];
    const secondaryToLastBlock = config[config.length - 2];
    expect(secondaryToLastBlock).toMatchObject(customOverrideBlock);
  });
});

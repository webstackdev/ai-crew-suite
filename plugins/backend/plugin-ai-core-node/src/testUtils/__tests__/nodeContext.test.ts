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
import { createTestNodeContext } from '../nodeContext';
import type { ToolRegistry } from '../../@types/tool';

const registry = (tools: Record<string, () => Promise<unknown>>): ToolRegistry => ({
  register: () => {},
  get: (id: string) =>
    tools[id]
      ? {
          id,
          invoke: async () => tools[id](),
        }
      : undefined,
  list: () => [],
});

describe('createTestNodeContext', () => {
  it('captures artifacts', async () => {
    const ctx = createTestNodeContext({});
    await ctx.emitArtifact('report', { ref: 'r1' });
    expect(ctx.artifacts).toEqual([{ kind: 'report', payload: { ref: 'r1' } }]);
  });

  it('enforces the tool allow-list', async () => {
    const ctx = createTestNodeContext({ allowedToolIds: ['good'] });
    await expect(ctx.tools.invoke({ toolId: 'bad', args: {} })).rejects.toThrow(/not in the allow-list/);
  });

  it('invokes a registered allow-listed tool', async () => {
    const toolRegistry = registry({ good: async () => 'ok' });
    const ctx = createTestNodeContext({ toolRegistry, allowedToolIds: ['good'] });
    const result = await ctx.tools.invoke({ toolId: 'good', args: {} });
    expect(result.output).toBe('ok');
  });

  it('freezes the clock', () => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    const ctx = createTestNodeContext({ now });
    expect(ctx.now()).toEqual(now);
  });
});

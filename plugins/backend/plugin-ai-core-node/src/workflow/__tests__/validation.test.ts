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
import { z } from 'zod';
import { validateWorkflowDefinition } from '../validation';
import { END, WorkflowDefinition } from '../definition';

const baseDef = (): WorkflowDefinition<{ ok: boolean }, { q: string }> => ({
  id: 'wf',
  inputSchema: z.object({ q: z.string() }),
  state: { schema: z.object({ ok: z.boolean() }), stateVersion: 1 },
  entryNode: 'a',
  nodes: {
    a: async () => ({ ok: true }),
  },
  edges: [{ from: 'a', route: () => END }],
  artifactKinds: [],
});

describe('validateWorkflowDefinition', () => {
  it('passes a valid definition', () => {
    expect(validateWorkflowDefinition(baseDef())).toEqual([]);
  });

  it('flags missing inputSchema', () => {
    const def = baseDef();
    // @ts-expect-error intentionally missing
    def.inputSchema = undefined;
    expect(validateWorkflowDefinition(def).some(v => v.message.includes('inputSchema'))).toBe(true);
  });

  it('flags entryNode not in nodes', () => {
    const def = baseDef();
    def.entryNode = 'missing';
    expect(validateWorkflowDefinition(def).some(v => v.message.includes('entryNode'))).toBe(true);
  });

  it('flags edge to unknown node', () => {
    const def = baseDef();
    def.edges = [{ from: 'a', to: 'nope' }];
    expect(validateWorkflowDefinition(def).some(v => v.message.includes("unknown node 'nope'"))).toBe(true);
  });

  it('flags interrupt on missing node', () => {
    const def = baseDef();
    def.interrupts = [
      {
        beforeNode: 'gate',
        approvalRequest: () => ({ reason: 'r', effect: 'write' }),
        applyDecision: () => ({}),
      },
    ];
    expect(validateWorkflowDefinition(def).some(v => v.message.includes('interrupt'))).toBe(true);
  });
});

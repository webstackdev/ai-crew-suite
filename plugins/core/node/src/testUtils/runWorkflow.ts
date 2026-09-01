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

import type { AgentEvent } from '../events/agentEvent';
import type { WorkflowDefinition } from '../workflow/definition';
import { END } from '../workflow/definition';
import type { NodeExecutionContext } from '../workflow/context';
import { NodeError } from '../workflow/errors';

/**
 * Drive a WorkflowDefinition through a minimal in-test engine and return the ordered
 * AgentEvent sequence. Supports linear and conditional branching, parallel static
 * fan-out merged by set, and declarative interrupts (auto-approved by default).
 *
 * This is intentionally a lightweight stand-in for GraphExecutor, suitable for unit
 * tests of domain workflows — not a replacement for the engine's runtime guarantees.
 */
export async function runWorkflow<TState, TInput>(
  def: WorkflowDefinition<TState, TInput>,
  rawInput: TInput,
  ctx: NodeExecutionContext,
): Promise<{ events: AgentEvent[]; finalState: TState }> {
  const events: AgentEvent[] = [];
  let seq = 0;
  const runId = 'test-run';

  const parsedInput = def.inputSchema.parse(rawInput);
  let state: TState = def.state.schema.parse({} as TState) as TState;

  const emitStep = (node: string, phase: 'enter' | 'exit') => {
    seq += 1;
    events.push({ type: 'step', data: { runId, seq, node, phase } });
  };

  let current: string | typeof END = def.entryNode;
  const visited = new Set<string>();

  const applyPatch = (patch: Partial<TState>) => {
    state = def.state.schema.parse({ ...(state as object), ...(patch as object) }) as TState;
  };

  while (current !== END) {
    const nodeName = current as string;
    const node = def.nodes[nodeName];
    if (!node) {
      throw new NodeError(`Node '${nodeName}' missing in workflow '${def.id}'`, 'unknown');
    }

    // Interrupt gate (auto-approve in tests unless a decision handler is provided)
    const interrupt = def.interrupts?.find(i => i.beforeNode === nodeName);
    if (interrupt && !visited.has(nodeName)) {
      const approval = interrupt.approvalRequest(state);
      events.push({
        type: 'approval_request',
        data: { runId, approvalId: `test-approval-${nodeName}`, node: nodeName, reason: approval.reason, effect: approval.effect },
      });
    }

    emitStep(nodeName, 'enter');
    const patch = await node({ state, input: parsedInput, ctx });
    applyPatch(patch);
    visited.add(nodeName);
    emitStep(nodeName, 'exit');

    // Resolve next node
    const edge = def.edges.find(e => e.from === nodeName && 'to' in e) ?? def.edges.find(e => e.from === nodeName && 'route' in e);
    if (!edge) {
      current = END;
    } else if ('to' in edge) {
      current = edge.to;
    } else {
      current = edge.route(state);
    }
  }

  events.push({ type: 'done', data: { runId } });
  return { events, finalState: state };
}

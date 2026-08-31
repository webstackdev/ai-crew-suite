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

/**
 * Exhaustive classification for engine-originated errors surfaced on `AgentEvent` `error` events.
 */
export type ErrorCode =
  | 'invalid_input'
  | 'tool_failed'
  | 'tool_denied'
  | 'model_failed'
  | 'budget_exceeded'
  | 'cancelled'
  | 'timeout'
  | 'state_validation'
  | 'interrupted'
  | 'guardrail_blocked'
  | 'unknown';

/**
 * Normalized event stream emitted by the AI Core execution engine.
 *
 * `step`, `token`, `tool_call`, `tool_result`, and `approval_request` all carry
 * a required `node` attribution so clients can build per-node timelines. `usage`
 * and `error` carry an optional `node` when attributable.
 */
export type AgentEvent =
  /** Lifecycle step transition for a named workflow node. */
  | {
      type: 'step';
      data: { runId: string; seq: number; node: string; phase: 'enter' | 'exit' };
    }
  /** Streaming model token or text chunk, attributed to the emitting node. */
  | { type: 'token'; data: { runId: string; node: string; text: string } }
  /** Tool invocation request emitted before a tool executes. */
  | { type: 'tool_call'; data: { runId: string; node: string; tool: string; args: unknown } }
  /** Tool invocation result emitted after a tool completes or fails. */
  | {
      type: 'tool_result';
      data: {
        runId: string;
        node: string;
        tool: string;
        ok: boolean;
        summary?: string;
        output?: unknown;
      };
    }
  /** Token usage totals reported by the model or engine. */
  | {
      type: 'usage';
      data: { runId: string; node?: string; input: number; output: number; total: number };
    }
  /** Request for human approval before continuing a run. */
  | {
      type: 'approval_request';
      data: { runId: string; approvalId: string; node: string; reason: string; effect: 'write' };
    }
  /** Artifact produced by the run. */
  | {
      type: 'artifact';
      data: { runId: string; kind: string; url?: string; ref?: string };
    }
  /** Successful completion marker for a run. */
  | { type: 'done'; data: { runId: string; sessionId?: string } }
  /** Non-recoverable error marker for a run. */
  | {
      type: 'error';
      data: { runId: string; node?: string; code: ErrorCode; retryable: boolean; message: string };
    };

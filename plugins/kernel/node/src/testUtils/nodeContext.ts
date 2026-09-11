/*
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

import type { LoggerService } from '@backstage/backend-plugin-api';
import type {
  NodeExecutionContext,
  ToolExecutor,
  ModelExecutor,
} from '../types/workflow/execution';
import type { ToolInvocationResult, ToolInvocationLimits } from '../types/storage/runtime';
import type {
  ToolRegistry,
  Tool,
} from '../types/tools/core';
import { NodeError } from '../workflow/errors';

/**
 * A lightweight, stateless no-operation logger implementation to suppress 
 * test output flooding unless an explicit logger service is passed in.
 */
const noopLogger: LoggerService = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
} as unknown as LoggerService;

/**
 * Structural options used to provision a controlled mock test context environment.
 */
export interface TestNodeContextOptions {
  /** A functional tool registry holding discoverable tool execution blueprints. */
  toolRegistry?: ToolRegistry;
  /** An explicit string array containing the tool identifiers authorized for invocation. */
  allowedToolIds?: string[];
  /** A scriptable mock language model provider implementation. */
  model?: ModelExecutor;
  /** A precise anchor date used to freeze or anchor temporal calculations. */
  now?: Date;
  /** A Backstage logging service adapter instance. */
  logger?: LoggerService;
  /** A custom abort signal token to track timeout behavior and pipeline cancellations. */
  signal?: AbortSignal;
}

/**
 * An extended execution context variant that includes an immutable trace snapshot vector 
 * for checking emitted artifacts.
 */
export type TestNodeExecutionContext = NodeExecutionContext & {
  /** Exposes a read-only audit log of artifacts captured during execution. */
  readonly capturedArtifacts: Array<{ kind: string; payload: unknown }>;
};

/**
 * Provisions a controllable, fully deterministic `NodeExecutionContext` container for unit tests.
 * 
 * This harness provides robust sandboxing for sensitive runtime dependencies:
 * - **Tool Restrictions**: Restricts code execution to an explicit allowlist and verifies registrations against a registry.
 * - **Time Anchoring**: Anchors temporal queries to a fixed clock point to guarantee reliable assertions across test runner threads.
 * - **Telemetry Extraction**: Captures output payload metrics in an isolated collection log array for easy verification.
 * - **Cancellation Testing**: Connects natively to inbound AbortSignals to mirror production lifecycle cancellation handling.
 * 
 * @param options - Explicit environment attributes, model scripts, and security controls.
 * @returns A fully operational context container joined with an immutable artifact audit vector.
 * 
 * @example
 * ```typescript
 * const context = createTestNodeContext({
 *   allowedToolIds: ['calculator'],
 *   now: new Date('2026-09-12T00:00:00.000Z')
 * });
 * 
 * await context.emitArtifact('summary_metric', { score: 98 });
 * expect(context.capturedArtifacts[0].kind).toBe('summary_metric');
 * ```
 */
export function createTestNodeContext(options: TestNodeContextOptions = {}): TestNodeExecutionContext {
  const artifacts: Array<{ kind: string; payload: unknown }> = [];
  const allowed = new Set(options.allowedToolIds ?? []);
  const registry = options.toolRegistry;
  
  // Connect cleanly to an inbound control token or provision a dummy controller fallback
  const hostSignal = options.signal ?? new AbortController().signal;

  const tools: ToolExecutor = {
    async invoke<TArgs = unknown, TResult = unknown>(input: {
      toolId: string;
      args: TArgs;
      limits?: ToolInvocationLimits;
    }): Promise<ToolInvocationResult<TResult>> {
      if (hostSignal.aborted) {
        throw new NodeError('Operation aborted by the execution host environment', 'tool_failed');
      }

      if (allowed.size > 0 && !allowed.has(input.toolId)) {
        throw new NodeError(`Tool '${input.toolId}' is not in the allow-list`, 'tool_denied');
      }
      
      const tool: Tool | undefined = registry?.get(input.toolId);
      if (!tool) {
        throw new NodeError(`Tool '${input.toolId}' not registered`, 'tool_failed');
      }

      const output = await tool.invoke(input.args, {
        logger: options.logger ?? noopLogger,
        identity: 'test-actor',
        runId: 'test-run',
        signal: hostSignal,
      });

      return { 
        toolId: input.toolId, 
        output: output as TResult, 
        summary: '' 
      };
    },
  };

  const model: ModelExecutor = options.model ?? {
    async *stream() { /* Yields no initial data frames */ },
    async invoke() { return ''; },
    forTier() { return this; },
  };

  const ctx: TestNodeExecutionContext = {
    logger: options.logger ?? noopLogger,
    tools,
    model,
    capturedArtifacts: artifacts,
    async emitArtifact(kind, payload) {
      artifacts.push({ kind, payload });
    },
    now: () => options.now ?? new Date('2026-01-01T00:00:00.000Z'),
    signal: hostSignal,
  };

  return ctx;
}

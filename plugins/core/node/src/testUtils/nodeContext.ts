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

import type { LoggerService } from '@backstage/backend-plugin-api';
import type { NodeExecutionContext, ToolExecutor, ModelExecutor } from '../workflow/context';
import type { ToolInvocationResult, ToolInvocationLimits } from '../@types/run';
import type { ToolRegistry, Tool } from '../@types/tool';
import { NodeError } from '../workflow/errors';

const noopLogger: LoggerService = {
  debug: () => {}, info: () => {}, warn: () => {}, error: () => {},
  child: () => noopLogger,
} as unknown as LoggerService;

/**
 * Build a controllable NodeExecutionContext for unit tests.
 * Tools are looked up only from the supplied registry and must be allow-listed.
 * The clock is frozen/controlled; artifacts are captured for assertion.
 */
export function createTestNodeContext(options: {
  toolRegistry?: ToolRegistry;
  allowedToolIds?: string[];
  model?: ModelExecutor;
  now?: Date;
  logger?: LoggerService;
}): NodeExecutionContext & { artifacts: { kind: string; payload: unknown }[] } {
  const artifacts: { kind: string; payload: unknown }[] = [];
  const allowed = new Set(options.allowedToolIds ?? []);
  const registry = options.toolRegistry;

  const tools: ToolExecutor = {
    async invoke<TArgs = unknown, TResult = unknown>(input: {
      toolId: string;
      args: TArgs;
      limits?: ToolInvocationLimits;
    }): Promise<ToolInvocationResult<TResult>> {
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
        signal: new AbortController().signal,
      });
      return { toolId: input.toolId, output: output as TResult, summary: '' };
    },
  };

  const model: ModelExecutor = options.model ?? {
    async *stream() { /* empty */ },
    async invoke() { return ''; },
    forTier() { return this; },
  };

  const ctx: NodeExecutionContext & { artifacts: { kind: string; payload: unknown }[] } = {
    logger: options.logger ?? noopLogger,
    tools,
    model,
    artifacts,
    async emitArtifact(kind, payload) {
      artifacts.push({ kind, payload });
    },
    now: () => options.now ?? new Date('2026-01-01T00:00:00.000Z'),
    signal: new AbortController().signal,
  };
  return ctx;
}

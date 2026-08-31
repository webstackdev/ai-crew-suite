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
import type { ToolInvocationLimits, ToolInvocationResult } from '../@types/run';

/** A chat-model message in `ModelExecutor` requests. */
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** A JSON-schema tool spec passed to models that support tool-calling. */
export type ToolSpec = {
  name: string;
  description?: string;
  schema?: unknown;
};

/** A single streamed chunk emitted by a model. */
export type ModelChunk = {
  text?: string;
  toolCalls?: { id: string; name: string; args: unknown }[];
  usage?: { input: number; output: number; total: number };
};

/**
 * The only path to tools from within a workflow node. Enforces allow-lists, provider
 * policy, RBAC filtering, effect gating, budgets, and audit. Provided by the engine.
 */
export type ToolExecutor = {
  invoke<TArgs = unknown, TResult = unknown>(input: {
    toolId: string;
    args: TArgs;
    limits?: ToolInvocationLimits;
  }): Promise<ToolInvocationResult<TResult>>;
  /**
   * Scatter-gather over all providers allowed for this call. Opt-in per category;
   * a category must declare `supportsScatterGather`. Per-provider failures captured.
   */
  invokeAll?<TArgs = unknown, TResult = unknown>(input: {
    toolId: string;
    args: TArgs;
    limits?: ToolInvocationLimits;
  }): Promise<ToolInvocationResult<TResult>[]>;
};

/**
 * The only path to models from within a workflow node. Streams tokens as events and
 * enforces token budgets. Provider-neutral; resolved from the agent's modelRef or a tier.
 */
export type ModelExecutor = {
  stream(input: { messages: ChatMessage[]; tools?: ToolSpec[] }): AsyncIterable<ModelChunk>;
  invoke(input: { messages: ChatMessage[] }): Promise<string>;
  /** Returns an executor bound to a named tier (`fast` / `reasoning` / ...). */
  forTier(tier: string): ModelExecutor;
};

/**
 * The plugin-facing facade for node execution. This is the ONLY interface plugins may
 * use to invoke tools/models, emit artifacts, observe time, or log. Provided by the engine.
 */
export type NodeExecutionContext = {
  /** Run-scoped logger; all lines carry runId + node. */
  logger: LoggerService;
  /** The only path to tools. */
  tools: ToolExecutor;
  /** The only path to models. */
  model: ModelExecutor;
  /** Emit a typed artifact event + persist. Kind must be declared on the workflow. */
  emitArtifact(kind: string, payload: { ref?: string; url?: string }): Promise<void>;
  /** Deterministic clock (injectable; defaults to Date). Tests freeze it. */
  now(): Date;
  /** Abort signal honoring run cancellation and per-node timeouts. */
  signal: AbortSignal;
};

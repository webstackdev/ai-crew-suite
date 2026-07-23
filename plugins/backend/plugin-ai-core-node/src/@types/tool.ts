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

import { LoggerService } from '@backstage/backend-plugin-api';
import { AugmentationIndexer, RetrievalPipeline } from './rag';

/**
 * Runtime context provided to a tool invocation.
 */
export type ToolContext = {
  /** Optional credentials object supplied by the caller or host integration. */
  credentials?: unknown;
  /** Optional auth helper supplied by the host application. */
  auth?: unknown;
  /** Optional discovery helper supplied by the host application. */
  discovery?: unknown;
  /** Logger scoped to the current backend runtime. */
  logger: LoggerService;
  /** Identity ref or label for the actor that started the run. */
  identity: string;
  /** Run identifier used for tracing and audit correlation. */
  runId: string;
  /** Abort signal that tools should observe for cancellation and timeout handling. */
  signal: AbortSignal;
};

/**
 * Executable tool that can be invoked by an agent or orchestration pipeline.
 */
export interface Tool<A = unknown, R = unknown> {
  /** Unique tool identifier used by agent definitions and events. */
  id: string;
  /** Human-readable summary of the tool's behavior. */
  description?: string;
  /** Optional input schema understood by clients or validation layers. */
  schema?: unknown;
  /** Executes the tool with caller-provided arguments and runtime context. */
  invoke(args: A, ctx: ToolContext): Promise<R>;
  /** Declares whether the tool only reads data or may modify external systems. */
  effect?: 'read' | 'write';
}

/**
 * Registry of tools available to orchestrators and agents.
 */
export interface ToolRegistry {
  /** Adds a tool to the registry. Implementations should reject duplicate IDs. */
  register(tool: Tool): void;
  /** Returns a tool by ID, or `undefined` when it is not registered. */
  get(id: string): Tool | undefined;
  /** Returns all registered tools in registry order. */
  list(): Tool[];
}

/**
 * Tool registration shape used by backend modules.
 */
export type ToolDefinition = Tool & {
  /** Optional indexer exposed by this tool for embedding creation and deletion. */
  augmentationIndexer?: AugmentationIndexer;
  /** Optional retrieval pipeline exposed by this tool for augmentation lookups. */
  retrievalPipeline?: RetrievalPipeline;
};

export type ReadFileArgs = {
  repoUrl: string;
  path: string;
  ref?: string;
};

export type GetMetadataArgs = {
  repoUrl: string;
};

export type SearchRepositoryArgs = {
  repoUrl: string;
  query: string;
};

export type ListPullRequestsArgs = {
  repoUrl: string;
};

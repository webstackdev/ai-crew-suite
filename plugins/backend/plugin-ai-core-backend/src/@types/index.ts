/*
 * Copyright 2024 Larder Software Limited
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
import type { BaseLLM } from '@langchain/core/language_models/llms';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type {
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import type {
  AgentDefinition,
  ArtifactSink,
  AuditLogSink,
  AugmentationIndexer,
  CheckpointStore,
  RetrievalPipeline,
  RunStore,
  SessionStore,
  SourceRegistry,
  ToolDefinition,
  ToolRegistry,
  TriggerBinding,
} from '@webstackbuilders/plugin-ai-core-node';
import type { AgentRuntime } from '../runtime';
import type { AiCoreController } from '../service/controller';
import type { Config } from '../../config';

/** Plugin configuration */
export type AiBackendConfig = NonNullable<Config['ai']>;

export type AgentsMap = Map<string, AgentDefinition>;
export type ModelRegistry = Map<string, BaseLLM | BaseChatModel>;
export type ToolMap = Map<string, ToolDefinition>;

/**
 * Raw dependency bundle used to assemble AI backend runtime services.
 *
 * Callers provide pre-registered sources, agents, tools, and models together
 * with optional persistence sinks used by run orchestration endpoints.
 */
export interface AiBackendServiceOptions {
  agents: AgentsMap;
  artifactSink?: ArtifactSink;
  auditLogSink?: AuditLogSink;
  checkpointStore?: CheckpointStore;
  config: RootConfigService;
  logger: LoggerService;
  models: ModelRegistry;
  runStore?: RunStore;
  sessionStore?: SessionStore;
  sourceRegistry: SourceRegistry;
  tools: ToolMap;
  triggers?: TriggerBinding[];
}

/**
 * Resolved service bundle returned by the backend composition factory.
 */
export interface AiBackendServices {
  aiBackendConfig?: AiBackendConfig;
  sourceRegistry: SourceRegistry;
  agents: Map<string, AgentDefinition>;
  defaultAgentId: string;
  augmentationIndexer: AugmentationIndexer;
  retrievalPipeline: RetrievalPipeline;
  toolRegistry: ToolRegistry;
  runtime: AgentRuntime;
  controller: AiCoreController;
}

/**
 * Fully resolved dependencies required to bind the HTTP router.
 *
 * This lower-level shape is useful when callers want to prebuild controller
 * services separately from express route registration.
 */
export interface RouterOptions extends AiBackendServiceOptions {
  defaultAgentId: string;
  augmentationIndexer: AugmentationIndexer;
  retrievalPipeline: RetrievalPipeline;
}

/**
 * Minimal controller surface needed by the router binder.
 */
export type RouteController = Pick<
  AiCoreController,
  | 'createEmbeddings'
  | 'deleteEmbeddings'
  | 'getEmbeddings'
  | 'listAgents'
  | 'startRun'
  | 'streamRunEvents'
  | 'approveRun'
  | 'triggerRun'
  | 'webhookRun'
>;

/**
 * Narrow route-binding contract for the express router.
 */
export interface CreateRouterOptions {
  logger: LoggerService;
  config: RootConfigService;
  sourceRegistry: SourceRegistry;
  controller: RouteController;
}

/**
 * Normalized token accounting captured from model stream chunks.
 *
 * Used by orchestrators to emit consistent usage events and enforce
 * runtime budget controls regardless of the underlying model provider.
 */
export type UsageMetadata = {
  total_tokens: number;
  output_tokens: number;
  input_tokens: number;
};

/**
 * Declarative role definition for crew-style orchestration.
 *
 * Each role represents one handoff step in a multi-agent flow and can
 * optionally override model/tool selection from the parent agent defaults.
 */
export type CrewRole = {
  id: string;
  systemPrompt: string;
  modelRef?: string;
  toolIds?: string[];
};

export type HardeningOptions = {
  timeoutMs?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
  maxTotalTokens?: number;
  rateLimitPerMinute?: number;
};

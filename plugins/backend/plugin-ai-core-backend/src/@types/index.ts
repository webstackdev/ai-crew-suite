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
import type { RagAiController } from '../service/RagAiController';

/**
 * Raw dependency bundle used to assemble AI backend runtime services.
 *
 * Callers provide pre-registered sources, agents, tools, and models together
 * with optional persistence sinks used by run orchestration endpoints.
 */
export interface AiBackendServiceOptions {
  logger: LoggerService;
  sourceRegistry: SourceRegistry;
  agents: Map<string, AgentDefinition>;
  tools: Map<string, ToolDefinition>;
  models: Map<string, BaseLLM | BaseChatModel>;
  sessionStore?: SessionStore;
  checkpointStore?: CheckpointStore;
  runStore?: RunStore;
  artifactSink?: ArtifactSink;
  auditLogSink?: AuditLogSink;
  triggers?: TriggerBinding[];
  config: RootConfigService;
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
  controller: RagAiController;
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
  RagAiController,
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
 * Configuration contract for the AI backend plugin.
 *
 * Defines global defaults, per-agent overrides, orchestration behavior,
 * prompt wrappers, retrieval source allow-lists, and operational guardrails.
 *
 * @example
 * ```json
 * {
 *   "defaults": { "model": "gpt-4o" },
 *   "agents": {
 *     "scaffolding-bot": { "orchestrator": "langgraph", "memory": "session" }
 *   }
 * }
 * ```
 */
export interface AiBackendConfig {
  /** Fallback values used when a specific agent does not provide overrides. */
  defaults?: {
    /** Default agent ID used when a request does not explicitly select one. */
    agent?: string;
    /** Default model reference (for example, `gpt-4o` or `claude-3-5-sonnet`). */
    model?: string;
    /** Default system prompt applied when no agent-specific prompt is configured. */
    systemPrompt?: string;
  };

  /** Per-agent execution settings keyed by agent ID. */
  agents?: Record<
    string,
    {
      /** Model override for this agent. */
      model?: string;
      /** System prompt override for this agent. */
      systemPrompt?: string;
      /**
       * Orchestration strategy used to execute this agent.
       * - `single-shot`: One-pass retrieval and response.
       * - `langgraph`: Stateful graph-based orchestration.
       * - `crew`: Sequential multi-role collaboration.
       */
      orchestrator?: 'single-shot' | 'langgraph' | 'crew';
      /** Tool IDs that this agent is allowed to use. */
      tools?: string[];
      /**
       * Memory mode for this agent.
       * - `none`: Stateless execution.
       * - `session`: Persist conversational state per session.
       */
      memory?: 'none' | 'session';
      /** Crew role definitions, used only when `orchestrator` is `crew`. */
      crew?: {
        /** Ordered role list executed by the crew orchestrator. */
        roles: {
          /** Unique role identifier (for example, `security-auditor`). */
          id: string;
          /** System prompt that defines this role's behavior. */
          systemPrompt: string;
          /** Optional model override for this role. */
          model?: string;
          /** Optional tool IDs available only to this role. */
          tools?: string[];
        }[];
      };
    }
  >;

  /** Prompt wrappers applied to generated execution prompts. */
  prompts?: {
    /** Text prepended before the generated prompt body. */
    prefix: string;
    /** Text appended after the generated prompt body. */
    suffix: string;
  };

  /** Allowed retrieval source IDs (for example, `techdocs` or `confluence`). */
  supportedSources?: string[];

  /** Runtime hardening limits for timeout, retries, token budget, and rate control. */
  hardening?: {
    /** Request timeout in milliseconds. */
    timeoutMs?: number;
    /** Maximum retry attempts for transient failures. */
    maxRetries?: number;
    /** Base backoff delay in milliseconds between retries. */
    retryBackoffMs?: number;
    /** Maximum total tokens allowed per request lifecycle. */
    maxTotalTokens?: number;
    /** Maximum allowed requests per rolling minute window. */
    rateLimitPerMinute?: number;
  };
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

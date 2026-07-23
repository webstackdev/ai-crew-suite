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

// Note: Replace these LangChain placeholders with your monorepo's active imports
import { BaseLLM } from '@langchain/core/language_models/llms';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * Registers a language model that agents can reference by ID.
 */
export type ModelDefinition = {
  /** Unique model identifier used by agent definitions and crew roles. */
  id: string;
  /** LangChain LLM or chat model instance used for generation. */
  model: BaseLLM | BaseChatModel;
};

/**
 * Binds an external trigger source to an optional default agent.
 */
export type TriggerBinding = {
  /** Unique trigger identifier, such as `github-pr-opened` or `nightly-scan`. */
  id: string;
  /** Optional source name associated with the trigger payload. */
  source?: string;
  /** Optional agent to run when this trigger fires. */
  agentId?: string;
};

/**
 * Declarative profile for an agent that can be executed by the AI runtime.
 */
export type AgentDefinition = {
  /** Unique agent identifier used in API routes, triggers, and run records. */
  id: string;
  /** Model ID from the model registry that should be used by default. */
  modelRef: string;
  /** System prompt applied to the agent's model calls. */
  systemPrompt: string;
  /** Tool IDs the agent is allowed to use. */
  toolIds: string[];
  /** Orchestration strategy used to execute the agent. Defaults are runtime-defined. */
  orchestrator?: 'single-shot' | 'langgraph' | 'crew';
  /** Memory mode for the agent. `session` enables persisted conversational history. */
  memory?: 'none' | 'session';
  /** Optional crew configuration for multi-role sequential orchestration. */
  crew?: {
    /** Ordered roles executed by the crew orchestrator. */
    roles: {
      /** Unique role identifier within the agent's crew. */
      id: string;
      /** System prompt used for this role's model call. */
      systemPrompt: string;
      /** Optional model override for this role. Falls back to the agent model when omitted. */
      modelRef?: string;
      /** Optional tool allow-list override for this role. */
      toolIds?: string[];
    }[];
  };
  /** Optional trigger bindings that can start this agent. */
  triggers?: TriggerBinding[];
};

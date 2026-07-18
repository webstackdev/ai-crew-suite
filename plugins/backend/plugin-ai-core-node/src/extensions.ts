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

import {
  AgentDefinition,
  ModelDefinition,
  SourceDescriptor,
  ToolDefinition,
  TriggerBinding,
} from './@types';
import { createExtensionPoint } from '@backstage/backend-plugin-api';

/**
 * Extension point for registering retrieval/indexing sources with the AI backend.
 *
 * Backend modules use this to make a source ID available to the AI runtime before
 * the plugin boots. A source represents a logical content domain, for example
 * catalog entities, TechDocs pages, or an organization-specific knowledge base.
 */
export interface SourceExtensionPoint {
  /**
   * Registers a source descriptor.
   *
   * The AI backend plugin rejects duplicate source IDs at boot time so two
   * modules cannot accidentally claim the same source namespace.
   */
  addSource(source: SourceDescriptor): void;
}

/**
 * Backstage extension point used by modules that contribute AI retrieval sources.
 */
export const sourceExtensionPoint = createExtensionPoint<SourceExtensionPoint>({
  id: 'plugin-ai.source',
});

/**
 * Extension point for registering tools that agents may call.
 *
 * Tools can be read-only helpers, write-capable actions, or infrastructure
 * adapters that expose indexing and retrieval pipelines. Agent definitions refer
 * to tools by ID, so modules should register tools before the AI backend runtime
 * initializes.
 */
export interface ToolExtensionPoint {
  /**
   * Registers a tool definition.
   *
   * Duplicate tool IDs are rejected by the backend plugin so an agent cannot be
   * wired to an ambiguous implementation.
   */
  addTool(tool: ToolDefinition): void;
}

/**
 * Backstage extension point used by modules that contribute agent tools.
 */
export const toolExtensionPoint = createExtensionPoint<ToolExtensionPoint>({
  id: 'plugin-ai.tool',
});

/**
 * Extension point for registering language models by stable ID.
 *
 * Agent profiles and crew roles reference these IDs through `modelRef`. Modules
 * should use this extension point when they provide a configured LangChain LLM or
 * chat model instance for the AI backend to execute.
 */
export interface ModelExtensionPoint {
  /**
   * Registers a model definition.
   *
   * Duplicate model IDs are rejected at boot time to prevent silent model
   * replacement across modules.
   */
  addModel(model: ModelDefinition): void;
}

/**
 * Backstage extension point used by modules that contribute AI model instances.
 */
export const modelExtensionPoint = createExtensionPoint<ModelExtensionPoint>({
  id: 'plugin-ai.model',
});

/**
 * Extension point for registering executable agent profiles.
 *
 * Agent definitions describe the model, prompt, tools, memory mode, orchestration
 * strategy, and optional crew roles used for a runtime execution. This is the
 * main integration point for sub-plugins that want to add domain-specific AI
 * capabilities to the shared backend runtime.
 */
export interface AgentExtensionPoint {
  /**
   * Registers an agent profile.
   *
   * Duplicate agent IDs are rejected at boot time so different modules cannot
   * accidentally publish conflicting profiles under the same route/trigger ID.
   */
  addAgent(agent: AgentDefinition): void;
}

/**
 * Backstage extension point used by modules that contribute AI agent profiles.
 */
export const agentExtensionPoint = createExtensionPoint<AgentExtensionPoint>({
  id: 'plugin-ai.agent',
});

/**
 * Extension point for registering external trigger bindings.
 *
 * Trigger bindings connect webhook-like or scheduled sources to agent execution.
 * They do not execute work by themselves; the AI backend records them during boot
 * and uses them when trigger endpoints normalize incoming requests.
 */
export interface TriggerExtensionPoint {
  /** Registers a trigger binding that can map an external source to an agent. */
  addTrigger(trigger: TriggerBinding): void;
}

/**
 * Backstage extension point used by modules that contribute trigger bindings.
 */
export const triggerExtensionPoint =
  createExtensionPoint<TriggerExtensionPoint>({
    id: 'plugin-ai.trigger',
  });

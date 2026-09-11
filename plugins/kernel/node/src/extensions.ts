/*
 * Copyright 2024 Larder Software Limited
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

import {
  AgentDefinition,
  ArtifactSink,
  AuditLogSink,
  RunStore,
  SessionStore,
  SourceDescriptor,
  ToolDefinition,
  TriggerBinding,
} from './@types';
import { WorkflowDefinition } from './workflow';
import { CheckpointStore, StateSerializer, UsageSink, VectorStoreDefinition } from './stores';
import {
  ChatModelDefinition,
  EmbeddingsDefinition,
  GuardrailDefinition,
  RerankingDefinition,
  TranscriptionDefinition,
} from './models';
import { createExtensionPoint } from '@backstage/backend-plugin-api';

export * from './tools';

/**
 * Extension point for registering executable agent profiles.
 */
export interface AgentExtensionPoint {
  addAgent(agent: AgentDefinition): void;
}

export const agentExtensionPoint = createExtensionPoint<AgentExtensionPoint>({
  id: 'plugin-agent.agents',
});

/**
 * Extension point that allows backend modules to register indexing and retrieval sources
 * (e.g., `catalog`, `techdocs`, or custom third-party integrations) with the central AI agent runtime.
 *
 * Registered sources provide the content pipelines utilized by agentic workflow plugins
 * for embeddings generation, knowledge indexing, and context-aware retrieval.
 */
export interface SourceExtensionPoint {
  addSource(source: SourceDescriptor): void;
}

export const sourceExtensionPoint = createExtensionPoint<SourceExtensionPoint>({
  id: 'plugin-agent.sources',
});

/**
 * Extension point that allows backend modules to register event-driven hooks and triggers
 * (e.g., webhook listeners, cron routines, or message queue consumers) into the central AI agent runtime.
 * 
 * Registered triggers intercept external platform events and automatically instantiate and route
 * them to execute a specific, pre-configured `AgentDefinition`.
 */
export interface TriggerExtensionPoint {
  addTrigger(trigger: TriggerBinding): void;
}

export const triggerExtensionPoint = createExtensionPoint<TriggerExtensionPoint>({
  id: 'plugin-agent.triggers',
});

/**
 * Extension point for registering domain-specific workflow definitions.
 */
export interface WorkflowRunnerExtensionPoint {
  registerWorkflow(workflow: WorkflowDefinition): void;
}
export const workflowRunnerExtensionPoint =
  createExtensionPoint<WorkflowRunnerExtensionPoint>({
    id: 'plugin-ai.workflow-runner',
  });

/**
 * Extension point that allows specialized backend modules (such as `github`, `gitlab`, or `aws-codecommit`)
 * to register concrete executable tools into the unified Version Control System (VCS) tool group interface.
 *
 * Registered tools are exposed to the core agentic runtime, enabling agent workflows to interact
 * uniformly with repositories, pull requests, and code hosting platforms.
 */
export interface ToolExtensionPoint {
  addTool(tool: ToolDefinition): void;
}

export const toolExtensionPoint = createExtensionPoint<ToolExtensionPoint>({
  id: 'tools-vcs.tools',
});

/** Chat model registrations (replaces the removed `modelExtensionPoint`). */
export interface ChatModelsExtensionPoint { addChatModel(d: ChatModelDefinition): void }

export const chatModelsExtensionPoint = createExtensionPoint<ChatModelsExtensionPoint>({
  id: 'plugin-ai.models.chat',
});

/** Embeddings provider registrations. */
export interface EmbeddingsExtensionPoint {
  addEmbeddings(d: EmbeddingsDefinition): void
}

export const embeddingsExtensionPoint = createExtensionPoint<EmbeddingsExtensionPoint>({
  id: 'plugin-ai.models.embeddings',
});

/** Transcription provider registrations. */
export interface TranscriptionExtensionPoint {
  addTranscription(d: TranscriptionDefinition): void
}

export const transcriptionExtensionPoint = createExtensionPoint<TranscriptionExtensionPoint>({
  id: 'plugin-ai.models.transcription',
});

/** Reranking provider registrations. */
export interface RerankingExtensionPoint {
  addReranking(d: RerankingDefinition): void
}

export const rerankingExtensionPoint = createExtensionPoint<RerankingExtensionPoint>({
  id: 'plugin-ai.models.reranking',
});

/** Guardrail classifier registrations. */
export interface GuardrailExtensionPoint {
  addGuardrail(d: GuardrailDefinition): void
}

export const guardrailExtensionPoint = createExtensionPoint<GuardrailExtensionPoint>({
  id: 'plugin-ai.models.guardrail',
});

/** Vector store provider registrations. */
export interface VectorStoreExtensionPoint {
  addVectorStore(d: VectorStoreDefinition): void
}

export const vectorStoreExtensionPoint = createExtensionPoint<VectorStoreExtensionPoint>({
  id: 'plugin-ai.storage.vector',
});

/**
 * Extension point for registering agent runtime persistence stores.
 */
export interface RuntimeStoreExtensionPoint {
  setSessionStore(store: SessionStore): void;
  setCheckpointStore(store: CheckpointStore): void;
  setRunStore(store: RunStore): void;
  setArtifactSink(sink: ArtifactSink): void;
  setAuditLogSink(sink: AuditLogSink): void;
  setUsageSink?(sink: UsageSink): void;
  setStateSerializer?(serializer: StateSerializer): void;
}

export const runtimeStoreExtensionPoint =
  createExtensionPoint<RuntimeStoreExtensionPoint>({
    id: 'plugin-ai.runtime-store',
  });

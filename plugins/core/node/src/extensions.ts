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
  ArtifactSink,
  AuditLogSink,
  CloudProviderDriver,
  CommunicationDriver,
  ComplianceDriver,
  IncidentManagementDriver,
  KubernetesDiagnosticsDriver,
  RunStore,
  SessionStore,
  SourceDescriptor,
  ToolDefinition,
  TriggerBinding,
  VcsDriver,
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

/**
 * Extension point for registering executable agent profiles.
 */
export interface AgentExtensionPoint {
  addAgent(agent: AgentDefinition): void;
}
export const agentExtensionPoint = createExtensionPoint<AgentExtensionPoint>({
  id: 'plugin-ai.agent',
});

/**
 * Extension point for registering sources.
 */
export interface SourceExtensionPoint {
  addSource(source: SourceDescriptor): void;
}
export const sourceExtensionPoint = createExtensionPoint<SourceExtensionPoint>({
  id: 'plugin-ai.source',
});

/**
 * Extension point for registering tools.
 */
export interface ToolExtensionPoint {
  addTool(tool: ToolDefinition): void;
}
export const toolExtensionPoint = createExtensionPoint<ToolExtensionPoint>({
  id: 'plugin-ai.tool',
});

/**
 * Extension point for registering external trigger bindings.
 */
export interface TriggerExtensionPoint {
  addTrigger(trigger: TriggerBinding): void;
}
export const triggerExtensionPoint = createExtensionPoint<TriggerExtensionPoint>({
  id: 'plugin-ai.trigger',
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

/** Cloud provider driver registry. */
export interface CloudDriversExtensionPoint {
  registerDriver(driver: CloudProviderDriver): void;
}
export const cloudDriversExtensionPoint = createExtensionPoint<CloudDriversExtensionPoint>({
  id: 'ai-core.cloud-drivers',
});

/** Communication driver registry. */
export interface CommunicationDriversExtensionPoint {
  registerDriver(driver: CommunicationDriver): void;
}
export const communicationDriversExtensionPoint =
  createExtensionPoint<CommunicationDriversExtensionPoint>({
    id: 'ai-core.communication-drivers',
  });

/** Compliance driver registry. */
export interface ComplianceDriversExtensionPoint {
  registerDriver(driver: ComplianceDriver): void;
}
export const complianceDriversExtensionPoint =
  createExtensionPoint<ComplianceDriversExtensionPoint>({
    id: 'ai-core.compliance-drivers',
  });

/** Incident management driver registry. */
export interface IncidentManagementDriversExtensionPoint {
  registerDriver(driver: IncidentManagementDriver): void;
}
export const incidentManagementDriversExtensionPoint =
  createExtensionPoint<IncidentManagementDriversExtensionPoint>({
    id: 'ai-core.incident-management-drivers',
  });

/** Kubernetes diagnostics driver registry. */
export interface KubernetesDiagnosticsDriversExtensionPoint {
  registerDriver(driver: KubernetesDiagnosticsDriver): void;
}
export const kubernetesDiagnosticsDriversExtensionPoint =
  createExtensionPoint<KubernetesDiagnosticsDriversExtensionPoint>({
    id: 'ai-core.kubernetes-diagnostics-drivers',
  });

/** Observability driver registry. */
export interface ObservabilityDriversExtensionPoint {
  registerDriver(driver: unknown): void;
}
export const observabilityDriversExtensionPoint =
  createExtensionPoint<ObservabilityDriversExtensionPoint>({
    id: 'ai-core.observability-drivers',
  });

/** Project management driver registry. */
export interface ProjectManagementDriversExtensionPoint {
  registerDriver(driver: unknown): void;
}
export const projectManagementDriversExtensionPoint =
  createExtensionPoint<ProjectManagementDriversExtensionPoint>({
    id: 'ai-core.project-management-drivers',
  });

/** Quality scorecards driver registry. */
export interface QualityScorecardsExtensionPoint {
  registerDriver(driver: unknown): void;
}
export const qualityScorecardsExtensionPoint =
  createExtensionPoint<QualityScorecardsExtensionPoint>({
    id: 'ai-core.quality-scorecards',
  });

/** VCS driver registry. */
export interface VcsDriversExtensionPoint {
  registerDriver(driver: VcsDriver): void;
}
export const vcsDriversExtensionPoint = createExtensionPoint<VcsDriversExtensionPoint>({
  id: 'ai-core.vcs.drivers',
});

/** Chat model registrations (replaces the removed `modelExtensionPoint`). */
export interface ChatModelsExtensionPoint { addChatModel(d: ChatModelDefinition): void }
export const chatModelsExtensionPoint = createExtensionPoint<ChatModelsExtensionPoint>({
  id: 'plugin-ai.models.chat',
});

/** Embeddings provider registrations. */
export interface EmbeddingsExtensionPoint { addEmbeddings(d: EmbeddingsDefinition): void }
export const embeddingsExtensionPoint = createExtensionPoint<EmbeddingsExtensionPoint>({
  id: 'plugin-ai.models.embeddings',
});

/** Transcription provider registrations. */
export interface TranscriptionExtensionPoint { addTranscription(d: TranscriptionDefinition): void }
export const transcriptionExtensionPoint = createExtensionPoint<TranscriptionExtensionPoint>({
  id: 'plugin-ai.models.transcription',
});

/** Reranking provider registrations. */
export interface RerankingExtensionPoint { addReranking(d: RerankingDefinition): void }
export const rerankingExtensionPoint = createExtensionPoint<RerankingExtensionPoint>({
  id: 'plugin-ai.models.reranking',
});

/** Guardrail classifier registrations. */
export interface GuardrailExtensionPoint { addGuardrail(d: GuardrailDefinition): void }
export const guardrailExtensionPoint = createExtensionPoint<GuardrailExtensionPoint>({
  id: 'plugin-ai.models.guardrail',
});

/** Vector store provider registrations. */
export interface VectorStoreExtensionPoint { addVectorStore(d: VectorStoreDefinition): void }
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

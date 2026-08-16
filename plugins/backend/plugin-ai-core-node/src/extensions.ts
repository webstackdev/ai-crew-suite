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
  CheckpointStore,
  CloudProviderDriver,
  CommunicationDriver,
  ComplianceDriver,
  IncidentManagementDriver,
  KubernetesDiagnosticsDriver,
  ModelDefinition,
  ObservabilityDriver,
  ProjectManagementDriver,
  QualityScorecardsDriver,
  RunStore,
  SessionStore,
  SourceDescriptor,
  ToolDefinition,
  TriggerBinding,
  VcsDriver,
} from './@types';
import { createExtensionPoint } from '@backstage/backend-plugin-api';

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
 * Extension point for registering custom Cloud Provider Drivers.
 * Sibling modules use this to register themselves dynamically at boot time.
 */
export interface CloudDriversExtensionPoint {
  /**
   * Registers a cloud provider driver.
   * Duplicate provider IDs overwrite or reject depending on core module map rules.
   */
  registerDriver(driver: CloudProviderDriver): void;
}

/**
 * Backstage extension point used by modules that contribute Cloud Provider drivers.
 */
export const cloudDriversExtensionPoint = createExtensionPoint<CloudDriversExtensionPoint>({
  id: 'ai-core.cloud-drivers',
});

/**
 * Extension point for registering governance and policy engine drivers such as
 * Open Policy Agent, enterprise policy registries, or FinOps policy services.
 *
 * Sibling modules use this to register themselves dynamically at boot time. The
 * core compliance module resolves the driver named by
 * `ai.integrations.compliance.provider` from the resulting registry.
 */
export interface ComplianceDriversExtensionPoint {
  /**
   * Registers a compliance driver.
   * Duplicate provider IDs overwrite or reject depending on core module map rules.
   */
  registerDriver(driver: ComplianceDriver): void;
}

/**
 * Backstage extension point used by modules that contribute compliance drivers.
 */
export const complianceDriversExtensionPoint =
  createExtensionPoint<ComplianceDriversExtensionPoint>({
    id: 'ai-core.compliance-drivers',
  });

/**
 * Extension point for registering transactional work tracking drivers such as
 * Jira, Linear, Asana, GitHub Projects, or GitLab Issues.
 *
 * Sibling modules use this to register themselves dynamically at boot time. The
 * core project management module resolves the driver named by
 * `ai.integrations.projectManagement.provider` from the resulting registry.
 */
export interface ProjectManagementDriversExtensionPoint {
  /**
   * Registers a project management driver.
   * Duplicate provider IDs overwrite or reject depending on core module map rules.
   */
  registerDriver(driver: ProjectManagementDriver): void;
}

/**
 * Backstage extension point used by modules that contribute project management drivers.
 */
export const projectManagementDriversExtensionPoint =
  createExtensionPoint<ProjectManagementDriversExtensionPoint>({
    id: 'ai-core.project-management-drivers',
  });

/**
 * Extension point for registering real-time human communication drivers such as
 * Slack or Microsoft Teams.
 *
 * Sibling modules use this to register themselves dynamically at boot time. The
 * core communication module resolves the driver named by
 * `ai.integrations.communication.provider` from the resulting registry.
 */
export interface CommunicationDriversExtensionPoint {
  /**
   * Registers a communication driver.
   * Duplicate provider IDs overwrite or reject depending on core module map rules.
   */
  registerDriver(driver: CommunicationDriver): void;
}

/**
 * Backstage extension point used by modules that contribute communication drivers.
 */
export const communicationDriversExtensionPoint =
  createExtensionPoint<CommunicationDriversExtensionPoint>({
    id: 'ai-core.communication-drivers',
  });

/**
 * Extension point for registering on-call, paging, and incident lifecycle
 * drivers such as PagerDuty, Opsgenie, or incident.io.
 *
 * Sibling modules use this to register themselves dynamically at boot time. The
 * core incident management module resolves the driver named by
 * `ai.integrations.incidentManagement.provider` from the resulting registry.
 */
export interface IncidentManagementDriversExtensionPoint {
  /**
   * Registers an incident management driver.
   * Duplicate provider IDs overwrite or reject depending on core module map rules.
   */
  registerDriver(driver: IncidentManagementDriver): void;
}

/**
 * Backstage extension point used by modules that contribute incident management drivers.
 */
export const incidentManagementDriversExtensionPoint =
  createExtensionPoint<IncidentManagementDriversExtensionPoint>({
    id: 'ai-core.incident-management-drivers',
  });

/**
 * Extension point for registering Kubernetes operational diagnostics drivers.
 *
 * The Kubernetes core module resolves the driver named by
 * `ai.integrations.kubernetes.provider` from the resulting registry. Drivers
 * own cluster authentication and catalog-to-workload resolution.
 */
export interface KubernetesDiagnosticsDriversExtensionPoint {
  registerDriver(driver: KubernetesDiagnosticsDriver): void;
}

/**
 * Backstage extension point used by modules that contribute Kubernetes diagnostics drivers.
 */
export const kubernetesDiagnosticsDriversExtensionPoint =
  createExtensionPoint<KubernetesDiagnosticsDriversExtensionPoint>({
    id: 'ai-core.kubernetes-diagnostics-drivers',
  });

/**
 * Extension point for registering telemetry platform drivers that serve metrics,
 * logs, traces, and dashboards, such as Datadog, New Relic, Splunk, Prometheus,
 * or Jaeger.
 *
 * Sibling modules use this to register themselves dynamically at boot time. The
 * core observability module resolves the driver named by
 * `ai.integrations.observability.provider` from the resulting registry.
 */
export interface ObservabilityDriversExtensionPoint {
  /**
   * Registers an observability driver.
   * Duplicate provider IDs overwrite or reject depending on core module map rules.
   */
  registerDriver(driver: ObservabilityDriver): void;
}

/**
 * Backstage extension point used by modules that contribute observability drivers.
 */
export const observabilityDriversExtensionPoint =
  createExtensionPoint<ObservabilityDriversExtensionPoint>({
    id: 'ai-core.observability-drivers',
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
 * Extension point for registering compliance, software health, and code quality scoring
 * engines with the AI backend framework.
 *
 * Backend modules use this to make a scorecard provider available to the AI runtime before
 * the plugin boots. A quality provider represents an internal ecosystem compliance evaluator,
 * for example Spotify Soundcheck, SonarQube quality gates, or custom enterprise matrix drivers.
 */
export interface QualityScorecardsExtensionPoint {
  /**
   * Registers a quality scorecards provider driver.
   *
   * The registered driver exposes normalized entity health summary schemas and architecture
   * radar proposal pipelines to downstream agentic workflow consumers.
   */
  registerDriver(driver: QualityScorecardsDriver): void;
}

/**
 * Backstage extension point used by modules that contribute Quality Scorecard drivers.
 */
export const qualityScorecardsExtensionPoint = createExtensionPoint<QualityScorecardsExtensionPoint>({
  id: 'ai-core.quality-scorecards-drivers',
});

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
export const triggerExtensionPoint = createExtensionPoint<TriggerExtensionPoint>({
    id: 'plugin-ai.trigger',
  });

/**
 * Extension point for registering agent runtime persistence stores.
 *
 * Runtime stores hold the durable state of the agent runtime: conversation
 * sessions, resumable checkpoints, run lifecycle and event logs, approval
 * decisions, artifacts, and audit records. Storage modules use this extension
 * point to supply implementations before the AI backend boots. When no store
 * is registered for a contract, the runtime operates without that persistence.
 */
export interface RuntimeStoreExtensionPoint {
  /**
   * Registers the store used for conversation session persistence.
   *
   * A second registration is rejected at boot time so two storage modules
   * cannot silently compete for the same runtime state.
   */
  setSessionStore(store: SessionStore): void;
  /**
   * Registers the store used for resumable orchestration checkpoints.
   *
   * A second registration is rejected at boot time.
   */
  setCheckpointStore(store: CheckpointStore): void;
  /**
   * Registers the store used for run lifecycle records, event logs, and approvals.
   *
   * A second registration is rejected at boot time.
   */
  setRunStore(store: RunStore): void;
  /**
   * Registers the sink that records artifacts produced by runs.
   *
   * A second registration is rejected at boot time.
   */
  setArtifactSink(sink: ArtifactSink): void;
  /**
   * Registers the sink that records auditable write actions and approval decisions.
   *
   * A second registration is rejected at boot time.
   */
  setAuditLogSink(sink: AuditLogSink): void;
}

/**
 * Backstage extension point used by modules that contribute agent runtime
 * persistence stores.
 */
export const runtimeStoreExtensionPoint = createExtensionPoint<RuntimeStoreExtensionPoint>({
  id: 'plugin-ai.runtime-store',
});

/**
 * Extension point for registering VCS drivers.
 * Sibling modules use this to register themselves dynamically at boot time.
 */
export interface VcsDriversExtensionPoint {
  /**
   * Registers a VCS driver.
   * Duplicate driver IDs overwrite or reject depending on core module map rules.
   */
  registerDriver(driver: VcsDriver): void;
}

/**
 * Backstage extension point used by modules that contribute VCS drivers.
 */
export const vcsDriversExtensionPoint = createExtensionPoint<VcsDriversExtensionPoint>({
  id: 'plugin-ai.vcs.drivers',
});

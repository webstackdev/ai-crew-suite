/*
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
import { TimeRange } from '../common';

/**
 * ============================================================================
 *   CORE DYNAMIC KUBERNETES DIAGNOSTICS DRIVER INTERFACE
 * ============================================================================
 */

/**
 * Provider-neutral diagnostics driver for Kubernetes operational state.
 *
 * Implementations must enforce Backstage/Kubernetes authorization and bound log
 * and event output before returning it to an AI tool invocation.
 */
export interface KubernetesDiagnosticsDriver {
  readonly providerId: string;
  /** Resolves a Backstage catalog entity reference down to its concrete cluster workload targets. */
  resolveWorkloads(query: KubernetesEntityQuery): Promise<KubernetesWorkloadRef[]>;
  /** Fetches a comprehensive architectural view of a target Deployment, StatefulSet, or DaemonSet. */
  getWorkloadSnapshot(query: KubernetesWorkloadQuery): Promise<KubernetesWorkloadSnapshot>;
  /** Fetches the specific operational phase and footprint summary of an isolated Pod. */
  getPodSnapshot(query: KubernetesPodQuery): Promise<KubernetesPodSnapshot>;
  /** Extracts a highly bounded, tail-truncated raw log buffer from a target container. */
  getPodLogs(query: KubernetesPodLogQuery): Promise<KubernetesPodLogExcerpt>;
  /** Gathers chronological event statements filtered by cluster workload scopes. */
  listWorkloadEvents(query: KubernetesEventQuery): Promise<KubernetesEventSummary[]>;
  /** Compiles an aggregated operational lifecycle history used to analyze recent cluster drift. */
  getWorkloadTimeline(query: KubernetesTimelineQuery): Promise<KubernetesWorkloadTimeline>;
}

/**
 * ============================================================================
 *   WORKLOAD IDENTIFIERS & REFERENCES
 * ============================================================================
 */

/**
 * Identifies a workload resolved through the Backstage catalog and Kubernetes
 * service-location model.
 */
export type KubernetesWorkloadRef = {
  /** Target cluster name token. */
  cluster: string;
  /** Target cluster isolated namespace. */
  namespace: string;
  /** Target resource descriptor name. */
  name: string;
  /** Foundational infrastructure orchestration kind. */
  kind: 'Deployment' | 'StatefulSet' | 'DaemonSet' | 'Job' | 'CronJob' | 'Pod';
  /** Backstage core tracking entity reference hook. */
  entityRef?: string;
};

/**
 * ============================================================================
 *   RESOURCE STATE SNAPSHOT DATA STRUCTURES (DTOs)
 * ============================================================================
 */

/**
 * Current deployment, StatefulSet, or DaemonSet diagnostic view.
 */
export type KubernetesWorkloadSnapshot = KubernetesWorkloadRef & {
  generation?: number;
  observedGeneration?: number;
  replicas?: {
    desired?: number;
    current?: number;
    ready?: number;
    available?: number;
    updated?: number;
  };
  conditions: { type: string; status: string; reason?: string; message?: string; updatedAt?: string }[];
  pods: KubernetesPodSnapshot[];
};

/**
 * Current diagnostic view of an individual pod resource vertex.
 */
export type KubernetesPodSnapshot = {
  cluster: string;
  namespace: string;
  name: string;
  phase?: string;
  reason?: string;
  message?: string;
  nodeName?: string;
  podIp?: string;
  startedAt?: string;
  containers: KubernetesContainerState[];
};

/**
 * A normalized container state, including waiting and termination reasons that
 * guide incident workflow branching.
 */
export type KubernetesContainerState = {
  name: string;
  ready: boolean;
  restartCount: number;
  state: 'running' | 'waiting' | 'terminated' | 'unknown';
  reason?: string;
  message?: string;
  exitCode?: number;
  startedAt?: string;
  finishedAt?: string;
};

/**
 * ============================================================================
 *   LOGS, EVENTS, AND TELEMETRY TIMELINES (DTOs)
 * ============================================================================
 */

/**
 * A bounded raw log excerpt. Drivers must truncate before returning it.
 */
export type KubernetesPodLogExcerpt = {
  cluster: string;
  namespace: string;
  pod: string;
  container?: string;
  previous: boolean;
  text: string;
  truncated: boolean;
  since?: string;
};

/**
 * Normalized Kubernetes Event warning or tracking record.
 */
export type KubernetesEventSummary = {
  cluster: string;
  namespace: string;
  type?: 'Normal' | 'Warning';
  reason?: string;
  message: string;
  involvedObject?: { kind?: string; name?: string; uid?: string };
  firstObservedAt?: string;
  lastObservedAt?: string;
  count?: number;
};

/**
 * Bounded workload timeline used for on-call handovers and deployment analysis.
 */
export type KubernetesWorkloadTimeline = {
  workload?: KubernetesWorkloadRef;
  events: KubernetesEventSummary[];
  snapshots: KubernetesWorkloadSnapshot[];
};

/**
 * ============================================================================
 *   DRIVER OPERATION QUERY CONSTRAINT PARAMETERS
 * ============================================================================
 */

export type KubernetesEntityQuery = {
  entityRef: string;
};

export type KubernetesWorkloadQuery = {
  cluster: string;
  namespace: string;
  name: string;
  kind?: KubernetesWorkloadRef['kind'];
};

export type KubernetesPodQuery = {
  cluster: string;
  namespace: string;
  pod: string;
};

export type KubernetesPodLogQuery = KubernetesPodQuery & TimeRange & {
  container?: string;
  previous?: boolean;
  tailLines?: number;
  maxBytes?: number;
};

export type KubernetesEventQuery = TimeRange & {
  cluster: string;
  namespace: string;
  workload?: string;
  pod?: string;
  limit?: number;
};

export type KubernetesTimelineQuery = TimeRange & {
  entityRef?: string;
  cluster?: string;
  namespace?: string;
  workload?: string;
  limit?: number;
};

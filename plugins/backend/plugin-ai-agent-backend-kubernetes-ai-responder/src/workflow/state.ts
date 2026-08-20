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
import type {
  KubernetesWorkloadRef,
  KubernetesWorkloadSnapshot,
} from '@webstackbuilders/plugin-ai-core-node';
import type { FailureClass } from './routing';

/**
 * Versioned incident trigger payload accepted from webhooks, schedulers, and
 * manual runs.
 */
export type KubernetesIncidentTrigger = {
  version: 1;
  source:
    | 'alertmanager'
    | 'datadog'
    | 'pagerduty'
    | 'prometheus'
    | 'manual'
    | 'scheduler';
  occurredAt: string;
  entityRef?: string;
  cluster?: string;
  namespace?: string;
  workload?: string;
  pod?: string;
  alertId?: string;
  severity?: string;
  summary: string;
  labels?: Record<string, string>;
};

/**
 * A single redacted, bounded evidence observation. Evidence is the only
 * content allowed into model context and the only valid citation target in a
 * report.
 */
export type IncidentEvidence = {
  /** Stable, unique evidence identifier used for report citations. */
  id: string;
  /** System the observation came from. */
  source: 'kubernetes' | 'vcs' | 'observability' | 'incident-management' | 'knowledge';
  /** Evidence category, such as `workload`, `pod`, `log`, or `event`. */
  kind: string;
  /** ISO timestamp of the observation, when known. */
  observedAt?: string;
  /** Redacted, bounded human-readable summary. */
  summary: string;
  /** Optional stable reference (artifact ID, object coordinates, URL). */
  reference?: string;
  /** Confidence of the observation itself, not of a derived cause. */
  confidence?: 'high' | 'medium' | 'low';
};

/**
 * Structured incident triage report persisted as a run artifact.
 */
export type IncidentTriageReport = {
  incidentId: string;
  entityRef?: string;
  status: 'investigated' | 'insufficient_evidence' | 'failed';
  /** Deterministic failure signature that routed the investigation. */
  failureClass: FailureClass;
  trigger: KubernetesIncidentTrigger;
  likelyCauses: { summary: string; confidence: number; evidence: string[] }[];
  /** Normalized evidence bundle, sorted by observation time. */
  timeline: IncidentEvidence[];
  recommendedNextSteps: string[];
  limitations: string[];
};

/**
 * Mutable state threaded through the triage graph nodes.
 */
export type InvestigationState = {
  trigger: KubernetesIncidentTrigger;
  workload?: KubernetesWorkloadRef;
  snapshot?: KubernetesWorkloadSnapshot;
  failureClass?: FailureClass;
  evidence: IncidentEvidence[];
  limitations: string[];
};

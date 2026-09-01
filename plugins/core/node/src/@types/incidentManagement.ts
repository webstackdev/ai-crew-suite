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
import { ServiceActor, TimeRange } from './common';

/**
 * Provider-neutral lifecycle state for an incident.
 */
export type IncidentState = 'triggered' | 'acknowledged' | 'resolved';

/**
 * How an alert or incident reached its resolved state. Alert tuning agents use
 * this to separate self-healing noise from alerts that required a human.
 */
export type IncidentResolutionKind = 'auto' | 'manual' | 'unresolved';

/**
 * Normalized incident record.
 */
export type IncidentSummary = {
  /** Provider incident identifier. */
  id: string;
  /** Incident title or summary. */
  title: string;
  /** Normalized lifecycle state. */
  state: IncidentState;
  /** Raw provider status name, preserved for prompts that need exact wording. */
  status?: string;
  /** Normalized urgency or severity label, such as `SEV1` or `high`. */
  severity?: string;
  /** Affected service identifier. */
  service?: string;
  /** Owning team or escalation policy identifier. */
  team?: string;
  /** Responders currently assigned to the incident. */
  assignees?: ServiceActor[];
  /** Canonical incident URL. */
  url?: string;
  /** ISO-8601 timestamp for when the incident was triggered. */
  triggeredAt?: string;
  /** ISO-8601 timestamp for when the incident was acknowledged. */
  acknowledgedAt?: string;
  /** ISO-8601 timestamp for when the incident was resolved. */
  resolvedAt?: string;
};

/**
 * Normalized note attached to an incident timeline.
 */
export type IncidentNote = {
  /** Provider note identifier when available. */
  id?: string;
  /** Note author. */
  author: ServiceActor;
  /** Plain text note body. */
  body: string;
  /** ISO-8601 creation timestamp. */
  createdAt?: string;
};

/**
 * Normalized incident record with responder notes expanded. Postmortem agents
 * read this to reconstruct a baseline timeline.
 */
export type IncidentDetail = IncidentSummary & {
  /** Incident description body as plain text. */
  description?: string;
  /** Responder notes in chronological order, oldest first. */
  notes?: IncidentNote[];
};

/**
 * Normalized alert occurrence. One entry represents a single firing of an alert
 * definition, not the definition itself.
 */
export type AlertHistoryEntry = {
  /** Provider alert or log entry identifier. */
  id: string;
  /** Identifier of the alert definition that fired. */
  alertId?: string;
  /** Alert definition title. */
  title: string;
  /** Normalized urgency or severity label. */
  severity?: string;
  /** Affected service identifier. */
  service?: string;
  /** ISO-8601 timestamp for when the alert fired. */
  triggeredAt?: string;
  /** ISO-8601 timestamp for when the alert cleared. */
  resolvedAt?: string;
  /** Whether the alert cleared on its own or required a responder. */
  resolution?: IncidentResolutionKind;
  /** Whether the alert paged a human rather than only being recorded. */
  paged?: boolean;
};

/**
 * A responder currently or prospectively holding an on-call shift.
 */
export type OnCallShift = {
  /** The responder holding the shift. */
  responder: ServiceActor;
  /** Escalation policy or rotation identifier. */
  policyId?: string;
  /** Escalation policy or rotation display name. */
  policyName?: string;
  /** Escalation level, where 1 is paged first. */
  escalationLevel?: number;
  /** ISO-8601 shift start. */
  start?: string;
  /** ISO-8601 shift end. */
  end?: string;
};

/**
 * Criteria for listing incidents.
 */
export type IncidentSearchQuery = TimeRange & {
  /** Restrict results to an affected service. */
  service?: string;
  /** Restrict results to an owning team or escalation policy. */
  team?: string;
  /** Restrict results to the given normalized states. */
  states?: IncidentState[];
  /** Maximum number of results. Drivers clamp this to their own page limits. */
  limit?: number;
};

/**
 * Criteria for reading alert history.
 */
export type AlertHistoryQuery = TimeRange & {
  /** Restrict results to an affected service. */
  service?: string;
  /** Restrict results to an owning team or escalation policy. */
  team?: string;
  /** Restrict results to a single alert definition. */
  alertId?: string;
  /** Maximum number of results. Drivers clamp this to their own page limits. */
  limit?: number;
};

/**
 * Criteria for resolving who is on call.
 */
export type OnCallQuery = {
  /** Restrict results to an affected service. */
  service?: string;
  /** Restrict results to an owning team. */
  team?: string;
  /** Restrict results to a single escalation policy or rotation. */
  policyId?: string;
  /** ISO-8601 instant to resolve against. Defaults to now. */
  at?: string;
};

/**
 * Provider-neutral driver for on-call, paging, and incident lifecycle services
 * such as PagerDuty, Opsgenie, or incident.io.
 */
export interface IncidentManagementDriver {
  /** Unique provider identifier, such as `pagerduty`. */
  readonly providerId: string;
  /** Lists incidents matching the given criteria. */
  listIncidents(query: IncidentSearchQuery): Promise<IncidentSummary[]>;
  /** Fetches an incident with its responder notes. */
  getIncident(incidentId: string): Promise<IncidentDetail>;
  /** Resolves the responders currently holding the relevant on-call shifts. */
  getOnCallShifts(query: OnCallQuery): Promise<OnCallShift[]>;
  /** Reads back alert firing history over a bounded window. */
  getAlertHistory(query: AlertHistoryQuery): Promise<AlertHistoryEntry[]>;
  /** Appends a diagnostic note or run link to an incident timeline. */
  annotateIncident(incidentId: string, note: string): Promise<IncidentNote>;
}

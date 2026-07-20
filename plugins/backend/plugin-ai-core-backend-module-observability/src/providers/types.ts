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

export type IncidentSummary = {
  id: string;
  title: string;
  status: 'active' | 'resolved' | 'acknowledged';
  severity?: string;
  service?: string;
  assignee?: string;
  url?: string;
  createdAt?: string;
};

export type AlertHistoryEntry = {
  id: string;
  title: string;
  severity?: string;
  count?: number;
  lastTriggeredAt?: string;
  noiseScore?: number;
};

export type MetricsQueryResult = {
  metric: string;
  labels?: Record<string, string>;
  values: { timestamp: string; value: number }[];
};

export type LogSearchResult = {
  timestamp: string;
  level?: string;
  service?: string;
  message: string;
  metadata?: Record<string, string>;
};

export type TraceSearchResult = {
  traceId: string;
  spanId?: string;
  operation?: string;
  service?: string;
  durationMs?: number;
  error?: boolean;
};

export type AlertTuningSuggestion = {
  alertId: string;
  suggestion: string;
  confidence?: number;
};

export interface ObservabilityDriver {
  readonly providerId: string;
  listActiveIncidents(filter?: {
    service?: string;
    team?: string;
  }): Promise<IncidentSummary[]>;
  getAlertHistory(filter: {
    service?: string;
    since?: string;
    until?: string;
  }): Promise<AlertHistoryEntry[]>;
  queryMetrics(query: {
    query: string;
    since?: string;
    until?: string;
  }): Promise<MetricsQueryResult[]>;
  searchLogs(query: {
    query: string;
    service?: string;
    since?: string;
    until?: string;
  }): Promise<LogSearchResult[]>;
  searchTraces(query: {
    service?: string;
    operation?: string;
    errorOnly?: boolean;
    since?: string;
    until?: string;
  }): Promise<TraceSearchResult[]>;
  annotateIncident(incidentId: string, note: string): Promise<{ incidentId: string; annotated: boolean }>;
  suggestAlertTuning(alertId: string): Promise<AlertTuningSuggestion>;
}

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
import { TimeRange } from './common';

/**
 * A single timestamped sample in a metric series.
 */
export type MetricPoint = {
  /** ISO-8601 sample timestamp. */
  timestamp: string;
  /** Sample value. */
  value: number;
};

/**
 * Normalized metric series.
 */
export type MetricSeries = {
  /** Metric name as returned by the provider. */
  metric: string;
  /** Dimension labels or tags scoping this series. */
  labels?: Record<string, string>;
  /** Samples in chronological order, oldest first. */
  points: MetricPoint[];
  /** Unit label when the provider exposes one. */
  unit?: string;
};

/**
 * Normalized log severity.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Normalized log entry.
 */
export type LogEntry = {
  /** ISO-8601 entry timestamp. */
  timestamp: string;
  /** Normalized severity. */
  level?: LogLevel;
  /** Emitting service identifier. */
  service?: string;
  /** Log message body. */
  message: string;
  /** Correlated trace identifier when the provider exposes one. */
  traceId?: string;
  /** Structured attributes attached to the entry. */
  attributes?: Record<string, string>;
};

/**
 * Normalized distributed trace span.
 */
export type TraceSpan = {
  /** Trace identifier. */
  traceId: string;
  /** Span identifier. */
  spanId: string;
  /** Parent span identifier for non-root spans. */
  parentSpanId?: string;
  /** Operation or endpoint name. */
  operation?: string;
  /** Emitting service identifier. */
  service?: string;
  /** ISO-8601 span start timestamp. */
  startedAt?: string;
  /** Span duration in milliseconds. */
  durationMs?: number;
  /** Whether the span terminated in an error. */
  error?: boolean;
  /** Provider status message when the span errored. */
  statusMessage?: string;
};

/**
 * Link to a provider-hosted dashboard for a service or team.
 */
export type DashboardLink = {
  /** Provider dashboard identifier. */
  id: string;
  /** Dashboard display name. */
  title: string;
  /** Canonical dashboard URL. */
  url: string;
  /** Short description when the provider exposes one. */
  description?: string;
};

/**
 * Criteria for a metric query.
 */
export type MetricsQuery = TimeRange & {
  /** Provider-native query string. */
  query: string;
  /** Sampling interval in seconds. */
  stepSeconds?: number;
};

/**
 * Criteria for a log search.
 */
export type LogQuery = TimeRange & {
  /** Provider-native query string. */
  query?: string;
  /** Restrict results to an emitting service. */
  service?: string;
  /** Restrict results to the given normalized severities. */
  levels?: LogLevel[];
  /** Maximum number of entries. Drivers clamp this to their own page limits. */
  limit?: number;
};

/**
 * Criteria for a trace search.
 */
export type TraceQuery = TimeRange & {
  /** Restrict results to an emitting service. */
  service?: string;
  /** Restrict results to an operation or endpoint name. */
  operation?: string;
  /** Restrict results to a single trace. */
  traceId?: string;
  /** Return only spans that terminated in an error. */
  errorOnly?: boolean;
  /** Return only spans slower than this threshold. */
  minDurationMs?: number;
  /** Maximum number of spans. Drivers clamp this to their own page limits. */
  limit?: number;
};

/**
 * Criteria for listing dashboards.
 */
export type DashboardQuery = {
  /** Restrict results to a service. */
  service?: string;
  /** Restrict results to a team. */
  team?: string;
  /** Free text matched against dashboard titles. */
  text?: string;
};

/**
 * Provider-neutral driver for telemetry platforms that serve metrics, logs,
 * traces, and dashboards, such as Datadog, New Relic, Splunk, Prometheus,
 * OpenTelemetry collectors, or Jaeger.
 */
export interface ObservabilityDriver {
  /** Unique provider identifier, such as `datadog`. */
  readonly providerId: string;
  /** Runs a metric query over a bounded time window. */
  queryMetrics(query: MetricsQuery): Promise<MetricSeries[]>;
  /** Searches logs over a bounded time window. */
  searchLogs(query: LogQuery): Promise<LogEntry[]>;
  /** Searches distributed trace spans over a bounded time window. */
  searchTraces(query: TraceQuery): Promise<TraceSpan[]>;
  /** Lists dashboards relevant to a service or team. */
  listDashboards(query: DashboardQuery): Promise<DashboardLink[]>;
}

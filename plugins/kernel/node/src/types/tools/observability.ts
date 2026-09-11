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
 *   CORE DYNAMIC OBSERVABILITY DRIVER INTERFACE
 * ============================================================================
 */

/**
 * Provider-neutral driver for telemetry platforms that serve metrics, logs,
 * traces, and dashboards, such as Datadog, New Relic, Splunk, Prometheus,
 * OpenTelemetry collectors, or Jaeger.
 *
 * This contract isolates concrete logging and APM API queries cleanly inside
 * independent backend module blocks, providing system telemetry for all 18 agentic plugins.
 */
export interface ObservabilityDriver {
  /** Unique provider identifier, such as `datadog`, `prometheus`, or `splunk`. */
  readonly providerId: string;
  /** Runs a metric series sample query over a bounded time window. */
  queryMetrics(query: MetricsQuery): Promise<MetricSeries[]>;
  /** Searches structured system logs over a bounded time window. */
  searchLogs(query: LogQuery): Promise<LogEntry[]>;
  /** Searches distributed trace execution spans over a bounded time window. */
  searchTraces(query: TraceQuery): Promise<TraceSpan[]>;
  /** Lists provider-hosted operations dashboards relevant to a service or team. */
  listDashboards(query: DashboardQuery): Promise<DashboardLink[]>;
}

/**
 * ============================================================================
 *   METRICS DATA TRANSFER OBJECTS (DTOs)
 * ============================================================================
 */

/**
 * Normalized metric series container.
 */
export type MetricSeries = {
  /** Metric name as returned by the provider. */
  metric: string;
  /** Dimension labels or tags scoping this series. */
  labels?: Record<string, string>;
  /** Samples in chronological order, oldest first. */
  points: MetricPoint[];
  /** Unit label when the provider exposes one (e.g. `percent`, `bytes`). */
  unit?: string;
};

/**
 * A single timestamped sample in a metric series.
 */
export type MetricPoint = {
  /** ISO-8601 sample timestamp. */
  timestamp: string;
  /** Numeric sample value. */
  value: number;
};

/**
 * ============================================================================
 *   LOGS & DISTRIBUTED TRACING DATA TRANSFER OBJECTS (DTOs)
 * ============================================================================
 */

/** Normalized log severity string primitives. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Normalized log record entry.
 */
export type LogEntry = {
  /** ISO-8601 entry timestamp. */
  timestamp: string;
  /** Normalized severity rating. */
  level?: LogLevel;
  /** Emitting service workload identifier. */
  service?: string;
  /** Log message string body content. */
  message: string;
  /** Correlated trace identifier when the provider exposes one. */
  traceId?: string;
  /** Structured attributes or key-value payload parameters attached to the entry. */
  attributes?: Record<string, string>;
};

/**
 * Normalized distributed trace execution span boundary.
 */
export type TraceSpan = {
  /** Trace identifier tracking the entire macro transaction. */
  traceId: string;
  /** Span identifier tracking this specific operation block. */
  spanId: string;
  /** Parent span identifier for non-root spans. */
  parentSpanId?: string;
  /** Operation name or system endpoint descriptor path. */
  operation?: string;
  /** Emitting service workload identifier. */
  service?: string;
  /** ISO-8601 span start timestamp. */
  startedAt?: string;
  /** Span duration in milliseconds. */
  durationMs?: number;
  /** Whether the span transaction terminated in an error status code. */
  error?: boolean;
  /** Provider status explanation message when the span errored. */
  statusMessage?: string;
};

/**
 * ============================================================================
 *   PLATFORM VISUALIZATION LINK DESCRIPTORS
 * ============================================================================
 */

/**
 * Link to a provider-hosted monitoring dashboard for a service or team.
 */
export type DashboardLink = {
  /** Provider dashboard identifier string. */
  id: string;
  /** Dashboard display name or title copy block. */
  title: string;
  /** Canonical deep-link URL heading directly back to the SaaS dashboard UI view. */
  url: string;
  /** Short description summary copy block when the provider exposes one. */
  description?: string;
};

/**
 * ============================================================================
 *   DRIVER OPERATION QUERY CONSTRAINT PARAMETERS
 * ============================================================================
 */

/** Criteria for a metric query execution pass. */
export type MetricsQuery = TimeRange & {
  /** Provider-native query syntax or metric expression string. */
  query: string;
  /** Sampling interval step resolution in seconds. */
  stepSeconds?: number;
};

/** Criteria for an automated log search lookback pass. */
export type LogQuery = TimeRange & {
  /** Provider-native search text or log syntax filter query string. */
  query?: string;
  /** Restrict results to an emitting service workload source. */
  service?: string;
  /** Restrict results to the given normalized severities. */
  levels?: LogLevel[];
  /** Maximum number of entries. Drivers clamp this to their own page limits. */
  limit?: number;
};

/** Criteria for an automated distributed trace inspection lookup. */
export type TraceQuery = TimeRange & {
  /** Restrict results to an emitting service workload source. */
  service?: string;
  /** Restrict results to an operation or endpoint name. */
  operation?: string;
  /** Restrict results to a single explicit trace identifier chain. */
  traceId?: string;
  /** Return only spans that terminated in an error status code. */
  errorOnly?: boolean;
  /** Return only spans slower than this runtime duration threshold. */
  minDurationMs?: number;
  /** Maximum number of spans. Drivers clamp this to their own page limits. */
  limit?: number;
};

/** Criteria for compiling accessible dashboard listings. */
export type DashboardQuery = {
  /** Restrict results to a matching service moniker. */
  service?: string;
  /** Restrict results to a matching team owner reference string. */
  team?: string;
  /** Free text regex matched pattern evaluated against dashboard titles. */
  text?: string;
};

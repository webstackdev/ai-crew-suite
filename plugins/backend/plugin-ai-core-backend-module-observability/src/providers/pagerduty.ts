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
import { LoggerService } from '@backstage/backend-plugin-api';
import {
  AlertHistoryEntry,
  AlertTuningSuggestion,
  IncidentSummary,
  LogSearchResult,
  MetricsQueryResult,
  ObservabilityDriver,
  TraceSearchResult,
} from './types';

export type PagerDutyDriverConfig = {
  baseUrl?: string;
};

/**
 * PagerDuty-backed observability driver.
 *
 * This first pass is a stub focused on incident operations. A real
 * implementation will wire the PagerDuty REST API for incident listing and
 * annotation.
 */
export class PagerDutyDriver implements ObservabilityDriver {
  readonly providerId = 'pagerduty';
  private readonly logger: LoggerService;

  constructor(opts: { logger: LoggerService; config?: PagerDutyDriverConfig }) {
    this.logger = opts.logger;
  }

  async listActiveIncidents(_filter?: {
    service?: string;
    team?: string;
  }): Promise<IncidentSummary[]> {
    this.logger.debug('PagerDutyDriver.listActiveIncidents stub invoked');
    return [];
  }

  async getAlertHistory(_filter: {
    service?: string;
    since?: string;
    until?: string;
  }): Promise<AlertHistoryEntry[]> {
    this.logger.debug('PagerDutyDriver.getAlertHistory stub invoked');
    return [];
  }

  async queryMetrics(_query: {
    query: string;
    since?: string;
    until?: string;
  }): Promise<MetricsQueryResult[]> {
    // Metrics are handled by the metrics driver, not PagerDuty.
    return [];
  }

  async searchLogs(_query: {
    query: string;
    service?: string;
    since?: string;
    until?: string;
  }): Promise<LogSearchResult[]> {
    // Logs are handled by the logs driver, not PagerDuty.
    return [];
  }

  async searchTraces(_query: {
    service?: string;
    operation?: string;
    errorOnly?: boolean;
    since?: string;
    until?: string;
  }): Promise<TraceSearchResult[]> {
    // Traces are handled by the traces driver, not PagerDuty.
    return [];
  }

  async annotateIncident(
    incidentId: string,
    _note: string,
  ): Promise<{ incidentId: string; annotated: boolean }> {
    this.logger.debug('PagerDutyDriver.annotateIncident stub invoked', { incidentId });
    return { incidentId, annotated: true };
  }

  async suggestAlertTuning(alertId: string): Promise<AlertTuningSuggestion> {
    this.logger.debug('PagerDutyDriver.suggestAlertTuning stub invoked', { alertId });
    return { alertId, suggestion: 'No tuning suggestion available in stub mode' };
  }
}

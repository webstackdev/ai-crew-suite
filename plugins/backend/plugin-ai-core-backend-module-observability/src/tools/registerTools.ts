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
import { ToolDefinition } from '@webstackbuilders/plugin-ai-core-node';
import { ObservabilityDriver } from '../providers';

type ListActiveIncidentsArgs = { service?: string; team?: string };
type AlertHistoryArgs = { service?: string; since?: string; until?: string };
type MetricsQueryArgs = { query: string; since?: string; until?: string };
type LogsSearchArgs = { query: string; service?: string; since?: string; until?: string };
type TracesSearchArgs = { service?: string; operation?: string; errorOnly?: boolean; since?: string; until?: string };
type AnnotateIncidentArgs = { incidentId: string; note: string };
type SuggestTuningArgs = { alertId: string };

export const createObservabilityTools = (opts: {
  alertingDriver: ObservabilityDriver;
  metricsDriver: ObservabilityDriver;
  tracesDriver: ObservabilityDriver;
  logger: LoggerService;
}): ToolDefinition[] => {
  const { alertingDriver, metricsDriver, tracesDriver, logger } = opts;

  return [
    {
      id: 'observability.incident.list_active',
      description: 'List active incidents for a service, team, or escalation policy',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as ListActiveIncidentsArgs;
        logger.debug('observability.incident.list_active invoked', payload);
        return alertingDriver.listActiveIncidents(payload);
      },
    },
    {
      id: 'observability.alert.history',
      description: 'Return alert history and noise patterns for a service',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as AlertHistoryArgs;
        logger.debug('observability.alert.history invoked', payload);
        return alertingDriver.getAlertHistory(payload);
      },
    },
    {
      id: 'observability.metrics.query',
      description: 'Query metrics over a bounded time window',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as MetricsQueryArgs;
        logger.debug('observability.metrics.query invoked', payload);
        return metricsDriver.queryMetrics(payload);
      },
    },
    {
      id: 'observability.logs.search',
      description: 'Search logs around a time range and entity',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as LogsSearchArgs;
        logger.debug('observability.logs.search invoked', payload);
        return metricsDriver.searchLogs(payload);
      },
    },
    {
      id: 'observability.traces.search',
      description: 'Search traces by service, operation, or error signature',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as TracesSearchArgs;
        logger.debug('observability.traces.search invoked', payload);
        return tracesDriver.searchTraces(payload);
      },
    },
    {
      id: 'observability.incident.annotate',
      description: 'Add a diagnostic note or run link to an incident',
      effect: 'write',
      async invoke(args: unknown) {
        const payload = args as AnnotateIncidentArgs;
        logger.debug('observability.incident.annotate invoked', { incidentId: payload.incidentId });
        return alertingDriver.annotateIncident(payload.incidentId, payload.note);
      },
    },
    {
      id: 'observability.alert.suggest_tuning',
      description: 'Produce a provider-normalized alert tuning artifact',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as SuggestTuningArgs;
        logger.debug('observability.alert.suggest_tuning invoked', { alertId: payload.alertId });
        return alertingDriver.suggestAlertTuning(payload.alertId);
      },
    },
  ];
};

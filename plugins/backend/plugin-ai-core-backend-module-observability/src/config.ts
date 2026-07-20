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
import { Config } from '@backstage/config';

export type AlertingProviderId = 'pagerduty' | 'opsgenie';
export type MetricsProviderId = 'datadog' | 'newrelic' | 'prometheus';
export type TracesProviderId = 'opentelemetry' | 'jaeger';

export type ProviderConnectionConfig = {
  baseUrl?: string;
};

export type ObservabilityConfig = {
  alerting: AlertingProviderId;
  metrics: MetricsProviderId;
  traces: TracesProviderId;
  alertingProviders: Partial<Record<AlertingProviderId, ProviderConnectionConfig>>;
  metricsProviders: Partial<Record<MetricsProviderId, ProviderConnectionConfig>>;
  tracesProviders: Partial<Record<TracesProviderId, ProviderConnectionConfig>>;
};

const ALERTING_PROVIDERS: readonly AlertingProviderId[] = ['pagerduty', 'opsgenie'];
const METRICS_PROVIDERS: readonly MetricsProviderId[] = ['datadog', 'newrelic', 'prometheus'];
const TRACES_PROVIDERS: readonly TracesProviderId[] = ['opentelemetry', 'jaeger'];

const isAlertingProvider = (value: unknown): value is AlertingProviderId =>
  typeof value === 'string' && (ALERTING_PROVIDERS as readonly string[]).includes(value);
const isMetricsProvider = (value: unknown): value is MetricsProviderId =>
  typeof value === 'string' && (METRICS_PROVIDERS as readonly string[]).includes(value);
const isTracesProvider = (value: unknown): value is TracesProviderId =>
  typeof value === 'string' && (TRACES_PROVIDERS as readonly string[]).includes(value);

const readProviderConfigs = <T extends string>(
  config: Config,
  path: string,
  providers: readonly T[],
): Partial<Record<T, ProviderConnectionConfig>> => {
  const result: Partial<Record<T, ProviderConnectionConfig>> = {};
  const section = config.getOptionalConfig(path);
  if (!section) return result;
  for (const candidate of providers) {
    const providerConfig = section.getOptionalConfig(candidate);
    if (providerConfig) {
      result[candidate] = { baseUrl: providerConfig.getOptionalString('baseUrl') };
    }
  }
  return result;
};

export const readObservabilityConfig = (config: Config): ObservabilityConfig => {
  const obsConfig = config.getOptionalConfig('ai.integrations.observability');
  if (!obsConfig) {
    throw new Error(
      'Observability module requires ai.integrations.observability configuration to be set',
    );
  }

  const alerting = obsConfig.getOptionalString('alerting');
  if (!alerting) throw new Error('Observability module requires ai.integrations.observability.alerting to be set');
  if (!isAlertingProvider(alerting)) {
    throw new Error(`Unsupported alerting provider '${alerting}'. Supported: ${ALERTING_PROVIDERS.join(', ')}`);
  }

  const metrics = obsConfig.getOptionalString('metrics');
  if (!metrics) throw new Error('Observability module requires ai.integrations.observability.metrics to be set');
  if (!isMetricsProvider(metrics)) {
    throw new Error(`Unsupported metrics provider '${metrics}'. Supported: ${METRICS_PROVIDERS.join(', ')}`);
  }

  const traces = obsConfig.getOptionalString('traces');
  if (!traces) throw new Error('Observability module requires ai.integrations.observability.traces to be set');
  if (!isTracesProvider(traces)) {
    throw new Error(`Unsupported traces provider '${traces}'. Supported: ${TRACES_PROVIDERS.join(', ')}`);
  }

  return {
    alerting,
    metrics,
    traces,
    alertingProviders: readProviderConfigs(obsConfig, 'alertingProviders', ALERTING_PROVIDERS),
    metricsProviders: readProviderConfigs(obsConfig, 'metricsProviders', METRICS_PROVIDERS),
    tracesProviders: readProviderConfigs(obsConfig, 'tracesProviders', TRACES_PROVIDERS),
  };
};

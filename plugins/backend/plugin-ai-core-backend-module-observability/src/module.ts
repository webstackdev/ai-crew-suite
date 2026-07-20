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
import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { toolExtensionPoint } from '@webstackbuilders/plugin-ai-core-node';
import { readObservabilityConfig } from './config';
import { ObservabilityDriver, PagerDutyDriver } from './providers';
import { createObservabilityTools } from './tools';

export const aiCoreBackendModuleObservability = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'observability',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        tools: toolExtensionPoint,
      },
      async init({ config, logger, tools }) {
        const obsConfig = readObservabilityConfig(config);
        logger.info(
          `Initializing observability module with alerting '${obsConfig.alerting}', metrics '${obsConfig.metrics}', traces '${obsConfig.traces}'`,
        );

        // First pass: use PagerDuty driver for alerting, stubs for metrics/traces
        let alertingDriver: ObservabilityDriver;
        switch (obsConfig.alerting) {
          case 'pagerduty':
            alertingDriver = new PagerDutyDriver({
              logger: logger.child({ label: 'observability-pagerduty' }),
              config: obsConfig.alertingProviders.pagerduty,
            });
            break;
          case 'opsgenie':
            throw new Error(`Observability alerting provider '${obsConfig.alerting}' is not implemented yet`);
          default: {
            const exhaustive: never = obsConfig.alerting;
            throw new Error(`Unsupported alerting provider: ${exhaustive}`);
          }
        }

        // Metrics and traces drivers are stubs in the first pass
        const metricsDriver: ObservabilityDriver = {
          providerId: obsConfig.metrics,
          async listActiveIncidents() { return []; },
          async getAlertHistory() { return []; },
          async queryMetrics() { return []; },
          async searchLogs() { return []; },
          async searchTraces() { return []; },
          async annotateIncident() { return { incidentId: '', annotated: false }; },
          async suggestAlertTuning() { return { alertId: '', suggestion: '' }; },
        };

        const tracesDriver: ObservabilityDriver = {
          providerId: obsConfig.traces,
          async listActiveIncidents() { return []; },
          async getAlertHistory() { return []; },
          async queryMetrics() { return []; },
          async searchLogs() { return []; },
          async searchTraces() { return []; },
          async annotateIncident() { return { incidentId: '', annotated: false }; },
          async suggestAlertTuning() { return { alertId: '', suggestion: '' }; },
        };

        for (const tool of createObservabilityTools({
          alertingDriver,
          metricsDriver,
          tracesDriver,
          logger,
        })) {
          tools.addTool(tool);
        }
      },
    });
  },
});

export default aiCoreBackendModuleObservability;

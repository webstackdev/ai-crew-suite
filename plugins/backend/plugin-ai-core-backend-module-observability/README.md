# @webstackbuilders/backstage-plugin-ai-core-backend-module-observability

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

This package implements the observability integration module for AI Crew Suite. It registers stable, provider-neutral incident, alert, metrics, logs, and traces tools with the AI Core backend through Backstage's module system, while hiding vendor-specific API calls behind an `ObservabilityDriver` interface.

### Core Responsibilities

- **Backend module registration**: Registers `aiCoreBackendModuleObservability` as an `ai-core` backend module.
- **Provider driver pattern**: Exposes an `ObservabilityDriver` interface with a PagerDuty driver stub for alerting.
- **Stable tool registration**: Registers `observability.incident.list_active`, `observability.alert.history`, `observability.metrics.query`, `observability.logs.search`, `observability.traces.search`, `observability.incident.annotate`, and `observability.alert.suggest_tuning`.
- **Config validation**: Reads and validates `ai.integrations.observability` configuration.

---

## Configuration

```yaml
ai:
  integrations:
    observability:
      alerting: pagerduty
      metrics: datadog
      traces: opentelemetry
      alertingProviders:
        pagerduty:
          baseUrl: https://events.pagerduty.com
```

Supported alerting: `pagerduty`, `opsgenie`. Supported metrics: `datadog`, `newrelic`, `prometheus`. Supported traces: `opentelemetry`, `jaeger`.

---

## Local Development Workflow

```bash
yarn install --refresh
yarn workspace @webstackbuilders/backstage-plugin-ai-core-backend-module-observability build
yarn workspace @webstackbuilders/backstage-plugin-ai-core-backend-module-observability test
```

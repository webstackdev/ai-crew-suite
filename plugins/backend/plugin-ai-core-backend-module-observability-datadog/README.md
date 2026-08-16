# @webstackbuilders/plugin-ai-core-backend-module-observability-datadog

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

Registers a Datadog `ObservabilityDriver` with
`@webstackbuilders/plugin-ai-core-backend-module-observability` through the
`observabilityDriversExtensionPoint`. This package owns Datadog API access and
response mapping; the core module owns the tool surface.

| Contract method | Datadog endpoint |
| --- | --- |
| `queryMetrics` | `GET /api/v1/query` |
| `searchLogs` | `POST /api/v2/logs/events/search` |
| `searchTraces` | `POST /api/v2/spans/events/search` |
| `listDashboards` | `GET /api/v1/dashboard` |

## Configuration

```yaml
ai:
  integrations:
    observability:
      provider: datadog
      datadog:
        apiKey: ${DATADOG_API_KEY}
        applicationKey: ${DATADOG_APP_KEY}
        # Set for non-US1 sites, for example the EU site:
        # apiBaseUrl: https://api.datadoghq.eu
        # appBaseUrl: https://app.datadoghq.eu
```

Both keys are required. Datadog read endpoints reject requests carrying only an
API key. Scope the application key to `logs_read_data`, `apm_read`, and
`dashboards_read`.

## Query Windows

Every query is bounded. When `since` and `until` are omitted the driver applies a
one hour lookback rather than issuing an open-ended request against a metered
API. Invalid or inverted ranges are rejected before the request is sent.

Datadog reports span durations in nanoseconds and metric timestamps in
milliseconds; both are normalized to the shared contract's milliseconds and
ISO-8601 strings.

## Installation

```ts
backend.add(
  loadBackendFeature(
    import('@webstackbuilders/plugin-ai-core-backend-module-observability-datadog'),
  ),
);
```

## Local Development Workflow

```bash
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-observability-datadog build
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-observability-datadog test
```

# @webstackbuilders/plugin-ai-core-backend-module-incident-management-pagerduty

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

Registers a PagerDuty `IncidentManagementDriver` with
`@webstackbuilders/plugin-ai-core-backend-module-incident-management` through the
`incidentManagementDriversExtensionPoint`. This package owns PagerDuty REST API
v2 access and response mapping; the core module owns the tool surface.

## Configuration

```yaml
ai:
  integrations:
    incidentManagement:
      provider: pagerduty
      pagerduty:
        apiToken: ${PAGERDUTY_API_TOKEN}
        fromEmail: ai-crew-suite@my-org.com
```

`fromEmail` must be a valid PagerDuty user. PagerDuty requires the `From` header
to attribute write operations, so `incident.incident.annotate` fails with a clear
error when it is not configured. Read-only tools work without it.

A read-only API key is sufficient unless you intend to use the annotate tool.

### Service and team filters

`service` and `team` filters accept a service name and a team ID respectively.
Service names are resolved to PagerDuty service IDs with a lookup call before the
incident query runs, because the PagerDuty API filters on IDs rather than names.

## Installation

```ts
backend.add(
  loadBackendFeature(
    import('@webstackbuilders/plugin-ai-core-backend-module-incident-management-pagerduty'),
  ),
);
```

## Local Development Workflow

```bash
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-incident-management-pagerduty build
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-incident-management-pagerduty test
```

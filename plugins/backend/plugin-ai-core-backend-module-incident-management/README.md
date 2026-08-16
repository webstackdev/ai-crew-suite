# @webstackbuilders/plugin-ai-core-backend-module-incident-management

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

This package is the **core module for the incident management integration
group**. It owns the provider-neutral on-call, paging, and incident lifecycle
contract and tool surface, and resolves a concrete vendor driver that a sibling
`-<provider>` package registers through an extension point at boot time. It
contains no vendor code and no vendor dependencies.

Paging and incident response is deliberately separate from telemetry. See
`plugin-ai-core-backend-module-observability` for Datadog, New Relic, and Splunk.

### Core Responsibilities

- **Backend module registration**: Registers `aiCoreBackendModuleIncidentManagement`
  as an `ai-core` backend module using `createBackendModule`.
- **Extension point**: Exposes `incidentManagementDriversExtensionPoint` so
  sibling modules can register `IncidentManagementDriver` implementations.
- **Driver resolution**: Selects the active driver from the runtime registry
  using `ai.integrations.incidentManagement.provider`.
- **Stable tool registration**: Registers `incident.incident.list`,
  `incident.incident.get`, `incident.oncall.get`, `incident.alert.history`, and
  `incident.incident.annotate` through `toolExtensionPoint`.

---

## Available Driver Modules

| Package | Driver ID |
| --- | --- |
| `@webstackbuilders/plugin-ai-core-backend-module-incident-management-pagerduty` | `pagerduty` |

---

## Configuration

This package owns only the driver selector. Connection details are owned by the
sibling driver packages.

```yaml
ai:
  integrations:
    incidentManagement:
      provider: pagerduty
```

Install the core module alongside the driver module you selected:

```ts
backend.add(
  loadBackendFeature(
    import('@webstackbuilders/plugin-ai-core-backend-module-incident-management'),
  ),
);
backend.add(
  loadBackendFeature(
    import('@webstackbuilders/plugin-ai-core-backend-module-incident-management-pagerduty'),
  ),
);
```

Boot fails with an explicit error when the selected identifier has no registered
driver.

---

## Authoring a New Driver Module

1. Create `plugin-ai-core-backend-module-incident-management-<provider>`.
2. Implement `IncidentManagementDriver` from `@webstackbuilders/plugin-ai-core-node`.
3. Depend on `incidentManagementDriversExtensionPoint` in `createBackendModule`
   and call `registerDriver` during `init`.
4. Own `ai.integrations.incidentManagement.<provider>` in your package's
   `config.d.ts`.

---

## Local Development Workflow

### 1. Prerequisites & Context

This workspace relies on the monorepo's shared **Yarn Plug'n'Play (PnP)** caching layout.

### 2. Installation & Builds

```bash
yarn install --refresh
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-incident-management build
```

### 3. Running Unit & Integration Tests

```bash
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-incident-management test
```

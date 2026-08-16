# @webstackbuilders/plugin-ai-core-backend-module-observability

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

This package is the **core module for the observability integration group**. It
owns the provider-neutral telemetry contract and tool surface, and resolves a
concrete vendor driver that a sibling `-<provider>` package registers through an
extension point at boot time. It contains no vendor code and no vendor
dependencies.

Telemetry is deliberately separate from paging. On-call schedules, alert routing,
and incident lifecycles live in
`plugin-ai-core-backend-module-incident-management`.

### Core Responsibilities

- **Backend module registration**: Registers `aiCoreBackendModuleObservability`
  as an `ai-core` backend module using `createBackendModule`.
- **Extension point**: Exposes `observabilityDriversExtensionPoint` so sibling
  modules can register `ObservabilityDriver` implementations.
- **Driver resolution**: Selects the active driver from the runtime registry
  using `ai.integrations.observability.provider`.
- **Stable tool registration**: Registers `observability.metrics.query`,
  `observability.logs.search`, `observability.traces.search`, and
  `observability.dashboard.list` through `toolExtensionPoint`.

Every tool in this group is `effect: 'read'`. Telemetry platforms are a source of
evidence for agents, never a target for autonomous writes.

---

## Available Driver Modules

| Package | Driver ID |
| --- | --- |
| `@webstackbuilders/plugin-ai-core-backend-module-observability-datadog` | `datadog` |

---

## Configuration

This package owns only the driver selector. Connection details are owned by the
sibling driver packages.

```yaml
ai:
  integrations:
    observability:
      provider: datadog
```

Install the core module alongside the driver module you selected:

```ts
backend.add(
  loadBackendFeature(
    import('@webstackbuilders/plugin-ai-core-backend-module-observability'),
  ),
);
backend.add(
  loadBackendFeature(
    import('@webstackbuilders/plugin-ai-core-backend-module-observability-datadog'),
  ),
);
```

Boot fails with an explicit error when the selected identifier has no registered
driver.

---

## Authoring a New Driver Module

1. Create `plugin-ai-core-backend-module-observability-<provider>`.
2. Implement `ObservabilityDriver` from `@webstackbuilders/plugin-ai-core-node`.
3. Depend on `observabilityDriversExtensionPoint` in `createBackendModule` and
   call `registerDriver` during `init`.
4. Own `ai.integrations.observability.<provider>` in your package's `config.d.ts`.

A driver that only serves part of the contract, for example a Prometheus driver
with no dashboard API, should return an empty result rather than throwing, so
agents degrade gracefully.

---

## Local Development Workflow

### 1. Prerequisites & Context

This workspace relies on the monorepo's shared **Yarn Plug'n'Play (PnP)** caching layout.

### 2. Installation & Builds

```bash
yarn install --refresh
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-observability build
```

### 3. Running Unit & Integration Tests

```bash
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-observability test
```

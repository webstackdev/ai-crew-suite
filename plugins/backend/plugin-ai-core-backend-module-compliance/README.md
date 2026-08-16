# @webstackbuilders/plugin-ai-core-backend-module-compliance

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

This package is the **core module for the compliance integration group**. It owns
the provider-neutral compliance contract and tool surface, and resolves a
concrete vendor driver that a sibling `-<provider>` package registers through an
extension point at boot time. It contains no vendor code and no vendor
dependencies.

### Core Responsibilities

- **Backend module registration**: Registers `aiCoreBackendModuleCompliance` as
  an `ai-core` backend module using `createBackendModule`.
- **Extension point**: Exposes `complianceDriversExtensionPoint` so sibling
  modules can register `ComplianceDriver` implementations.
- **Driver resolution**: Selects the active driver from the runtime registry
  using `ai.integrations.compliance.provider`.
- **Stable tool registration**: Registers `compliance.policy.evaluate`,
  `compliance.permission.check`, `compliance.architecture.validate`, and
  `compliance.cost.estimate` through `toolExtensionPoint`.

---

## Available Driver Modules

| Package                                                          | Driver ID |
| ---------------------------------------------------------------- | --------- |
| `@webstackbuilders/plugin-ai-core-backend-module-compliance-opa` | `opa`     |

---

## Configuration

This package owns only the driver selector. Connection details and policy paths
are owned by the sibling driver packages.

```yaml
ai:
  integrations:
    compliance:
      provider: opa
```

Install the core module alongside the driver module you selected:

```ts
backend.add(
  loadBackendFeature(
    import('@webstackbuilders/plugin-ai-core-backend-module-compliance'),
  ),
);
backend.add(
  loadBackendFeature(
    import('@webstackbuilders/plugin-ai-core-backend-module-compliance-opa'),
  ),
);
```

Boot fails with an explicit error when the selected identifier has no registered
driver.

---

## Authoring a New Driver Module

1. Create `plugin-ai-core-backend-module-compliance-<provider>`.
2. Implement `ComplianceDriver` from `@webstackbuilders/plugin-ai-core-node`.
3. Depend on `complianceDriversExtensionPoint` in `createBackendModule` and call
   `registerDriver` during `init`.
4. Own `ai.integrations.compliance.<provider>` in your package's `config.d.ts`.

---

## Local Development Workflow

```bash
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-compliance build
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-compliance test
```

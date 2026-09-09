# @webstackbuilders/plugin-ai-core-backend-module-project-management

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

This package is the **core module for the project management integration group**.
It owns the provider-neutral work tracking contract and tool surface, and
resolves a concrete vendor driver that a sibling `-<provider>` package registers
through an extension point at boot time. It contains no vendor code and no vendor
dependencies.

Transactional work tracking is deliberately separate from real-time chat. See
`plugin-ai-core-backend-module-communication` for Slack and Microsoft Teams.

### Core Responsibilities

- **Backend module registration**: Registers `aiCoreBackendModuleProjectManagement`
  as an `ai-core` backend module using `createBackendModule`.
- **Extension point**: Exposes `projectManagementDriversExtensionPoint` so sibling
  modules can register `ProjectManagementDriver` implementations.
- **Driver resolution**: Selects the active driver from the runtime registry
  using `ai.integrations.projectManagement.provider`.
- **Stable tool registration**: Registers `project.ticket.search`,
  `project.ticket.get`, `project.ticket.create`, and `project.ticket.comment`
  through `toolExtensionPoint`.

---

## Available Driver Modules

| Package | Driver ID |
| --- | --- |
| `@webstackbuilders/plugin-ai-core-backend-module-project-management-jira` | `jira` |

---

## Configuration

This package owns only the driver selector. Connection details are owned by the
sibling driver packages.

```yaml
ai:
  integrations:
    projectManagement:
      provider: jira
```

Install the core module alongside the driver module you selected:

```ts
backend.add(
  loadBackendFeature(
    import('@webstackbuilders/plugin-ai-core-backend-module-project-management'),
  ),
);
backend.add(
  loadBackendFeature(
    import('@webstackbuilders/plugin-ai-core-backend-module-project-management-jira'),
  ),
);
```

Boot fails with an explicit error when the selected identifier has no registered
driver.

---

## Authoring a New Driver Module

1. Create `plugin-ai-core-backend-module-project-management-<provider>`.
2. Implement `ProjectManagementDriver` from `@webstackbuilders/plugin-ai-core-node`.
3. Depend on `projectManagementDriversExtensionPoint` in `createBackendModule` and
   call `registerDriver` during `init`.
4. Own `ai.integrations.projectManagement.<provider>` in your package's `config.d.ts`.

---

## Local Development Workflow

### 1. Prerequisites & Context

This workspace relies on the monorepo's shared **Yarn Plug'n'Play (PnP)** caching layout.

### 2. Installation & Builds

```bash
yarn install --refresh
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-project-management build
```

### 3. Running Unit & Integration Tests

```bash
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-project-management test
```

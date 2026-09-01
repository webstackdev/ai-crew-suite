# @webstackbuilders/plugin-ai-core-backend-module-communication

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

This package is the **core module for the communication integration group**. It
owns the provider-neutral chat contract and tool surface, and resolves a concrete
vendor driver that a sibling `-<provider>` package registers through an extension
point at boot time. It contains no vendor code and no vendor dependencies.

Real-time chat is deliberately separate from transactional work tracking. See
`plugin-ai-core-backend-module-project-management` for Jira and Linear.

### Core Responsibilities

- **Backend module registration**: Registers `aiCoreBackendModuleCommunication`
  as an `ai-core` backend module using `createBackendModule`.
- **Extension point**: Exposes `communicationDriversExtensionPoint` so sibling
  modules can register `CommunicationDriver` implementations.
- **Driver resolution**: Selects the active driver from the runtime registry
  using `ai.integrations.communication.provider`.
- **Stable tool registration**: Registers `communication.channel.lookup`,
  `communication.channel.history`, and `communication.message.post` through
  `toolExtensionPoint`.

---

## Available Driver Modules

| Package | Driver ID |
| --- | --- |
| `@webstackbuilders/plugin-ai-core-backend-module-communication-slack` | `slack` |

---

## Configuration

This package owns only the driver selector. Connection details are owned by the
sibling driver packages.

```yaml
ai:
  integrations:
    communication:
      provider: slack
```

Install the core module alongside the driver module you selected:

```ts
backend.add(
  loadBackendFeature(
    import('@webstackbuilders/plugin-ai-core-backend-module-communication'),
  ),
);
backend.add(
  loadBackendFeature(
    import('@webstackbuilders/plugin-ai-core-backend-module-communication-slack'),
  ),
);
```

Boot fails with an explicit error when the selected identifier has no registered
driver.

---

## Authoring a New Driver Module

1. Create `plugin-ai-core-backend-module-communication-<provider>`.
2. Implement `CommunicationDriver` from `@webstackbuilders/plugin-ai-core-node`.
3. Depend on `communicationDriversExtensionPoint` in `createBackendModule` and
   call `registerDriver` during `init`.
4. Own `ai.integrations.communication.<provider>` in your package's `config.d.ts`.

---

## Local Development Workflow

### 1. Prerequisites & Context

This workspace relies on the monorepo's shared **Yarn Plug'n'Play (PnP)** caching layout.

### 2. Installation & Builds

```bash
yarn install --refresh
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-communication build
```

### 3. Running Unit & Integration Tests

```bash
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-communication test
```

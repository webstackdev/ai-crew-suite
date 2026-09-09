# @ai-crew-suite/tool-communication-core

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

This package is the **core module for the communication integration group**. It owns the provider-neutral chat contract and tool surface, and resolves a concrete vendor driver that a sibling extension package registers through an extension point at boot time. It contains no vendor code and no vendor dependencies.

Real-time chat is deliberately separate from transactional work tracking. See `@ai-crew-suite/tool-project-management-core` for Jira and Linear.

### Core Responsibilities

- **Backend module registration**: Registers `aiCoreBackendModuleCommunication` as an `ai-core` backend module using `createBackendModule`.
- **Extension point**: Exposes `communicationDriversExtensionPoint` so sibling modules can register `CommunicationDriver` implementations.
- **Driver resolution**: Selects the active driver from the runtime registry using `ai.integrations.communication.provider`.
- **Stable tool registration**: Registers `communication.channel.lookup`, `communication.channel.history`, and `communication.message.post` through the system tool extension points.

## Available Driver Modules

| Package | Driver ID |
| --- | --- |
| `@ai-crew-suite/tool-communication-slack` | `slack` |

## Configuration

This package owns only the driver selector. Connection details are owned by the sibling driver packages.

```yaml
ai:
  integrations:
    communication:
      provider: slack
```

Install the core module alongside the driver module you selected:

```ts
backend.add(import('@ai-crew-suite/tool-communication-core'));
backend.add(import('@ai-crew-suite/tool-communication-slack'));
```

Boot fails with an explicit error when the selected identifier has no registered driver.

## Authoring a New Driver Module

1. Create a workspace directory under `plugins/tools/communication/<provider>`.
2. Implement `CommunicationDriver` from `@ai-crew-suite/tool-communication-core` (or its shared node types).
3. Depend on `communicationDriversExtensionPoint` in `createBackendModule` and call `registerDriver` during initialization.
4. Own `ai.integrations.communication.<provider>` in your package's `config.d.ts`.

## Local Development Workflow

```bash
yarn install --refresh
yarn turbo run build --filter=@ai-crew-suite/tool-communication-core
yarn turbo run lint --filter=@ai-crew-suite/tool-communication-core
yarn turbo run test --filter=@ai-crew-suite/tool-communication-core
```


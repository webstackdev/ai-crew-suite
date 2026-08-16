# @webstackbuilders/plugin-ai-core-backend-module-collaboration

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

This package is the **core module for the collaboration integration group**. It
owns the provider-neutral ticketing and messaging contracts and tool surface, and
resolves concrete vendor drivers that sibling `-<provider>` packages register
through extension points at boot time. It contains no vendor code and no vendor
dependencies.

### Core Responsibilities

- **Backend module registration**: Registers `aiCoreBackendModuleCollaboration`
  as an `ai-core` backend module using `createBackendModule`.
- **Extension points**: Exposes `ticketDriversExtensionPoint` and
  `messagingDriversExtensionPoint` so sibling modules can register
  `TicketProviderDriver` and `MessagingProviderDriver` implementations.
- **Driver resolution**: Selects the active drivers from the runtime registries
  using `ai.integrations.collaboration.ticketing` and `.messaging`.
- **Stable tool registration**: Registers `collaboration.ticket.search`,
  `collaboration.ticket.get`, `collaboration.ticket.create`,
  `collaboration.ticket.comment`, `collaboration.channel.lookup`,
  `collaboration.channel.history`, and `collaboration.message.post` through
  `toolExtensionPoint`.

The two capabilities are deliberately separated. Ticket management services
(Jira, Linear, Asana, GitHub Projects, GitLab Issues) and team communication
services (Slack, Microsoft Teams) implement different contracts, so a driver only
implements the interface it actually supports.

---

## Available Driver Modules

| Package | Capability | Driver ID |
| --- | --- | --- |
| `@webstackbuilders/plugin-ai-core-backend-module-collaboration-jira` | Ticketing | `jira` |
| `@webstackbuilders/plugin-ai-core-backend-module-collaboration-slack` | Messaging | `slack` |

---

## Configuration

This package owns only the driver selectors. Connection details are owned by the
sibling driver packages.

```yaml
ai:
  integrations:
    collaboration:
      ticketing: jira
      messaging: slack
```

Install the core module alongside the driver modules you selected:

```ts
backend.add(
  loadBackendFeature(
    import('@webstackbuilders/plugin-ai-core-backend-module-collaboration'),
  ),
);
backend.add(
  loadBackendFeature(
    import('@webstackbuilders/plugin-ai-core-backend-module-collaboration-jira'),
  ),
);
backend.add(
  loadBackendFeature(
    import('@webstackbuilders/plugin-ai-core-backend-module-collaboration-slack'),
  ),
);
```

Boot fails with an explicit error when the selected identifier has no registered
driver.

---

## Authoring a New Driver Module

1. Create `plugin-ai-core-backend-module-collaboration-<provider>`.
2. Implement `TicketProviderDriver` or `MessagingProviderDriver` from
   `@webstackbuilders/plugin-ai-core-node`.
3. Depend on the matching extension point in `createBackendModule` and call
   `registerDriver` during `init`.
4. Own `ai.integrations.collaboration.<provider>` in your package's
   `config.d.ts`.

---

## Local Development Workflow

### 1. Prerequisites & Context

This workspace relies on the monorepo's shared **Yarn Plug'n'Play (PnP)** caching layout.

### 2. Installation & Builds

```bash
yarn install --refresh
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-collaboration build
```

### 3. Running Unit & Integration Tests

```bash
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-collaboration test
```

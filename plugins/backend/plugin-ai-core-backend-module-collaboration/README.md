# @webstackbuilders/backstage-plugin-ai-core-backend-module-collaboration

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

This package implements the collaboration integration module for AI Crew Suite. It registers stable, provider-neutral ticketing and messaging tools with the AI Core backend through Backstage's module system, while hiding vendor-specific API calls behind a `CollaborationDriver` interface.

### Core Responsibilities

- **Backend module registration**: Registers `aiCoreBackendModuleCollaboration` as an `ai-core` backend module using `createBackendModule`.
- **Provider driver pattern**: Exposes a `CollaborationDriver` interface with Jira (ticketing) and Slack (messaging) stub driver implementations.
- **Stable tool registration**: Registers `collaboration.ticket.search`, `collaboration.ticket.get`, `collaboration.channel.lookup`, `collaboration.ticket.create`, `collaboration.ticket.comment`, and `collaboration.message.post` through `toolExtensionPoint`.
- **Config validation**: Reads and validates `ai.integrations.collaboration` configuration, including ticketing and messaging provider selection.

---

## Configuration

Configure the collaboration module under `ai.integrations.collaboration` in your `app-config.yaml`:

```yaml
ai:
  integrations:
    collaboration:
      ticketing: jira
      messaging: slack
      ticketingProviders:
        jira:
          baseUrl: https://my-org.atlassian.net
      messagingProviders:
        slack:
          baseUrl: https://my-org.slack.com
```

Supported ticketing providers: `jira`, `linear`. Supported messaging providers: `slack`, `teams`.

---

## Local Development Workflow

### 1. Prerequisites & Context

This workspace relies on the monorepo's shared **Yarn Plug'n'Play (PnP)** caching layout.

### 2. Installation & Builds

```bash
yarn install --refresh
yarn workspace @webstackbuilders/backstage-plugin-ai-core-backend-module-collaboration build
```

### 3. Running Unit & Integration Tests

```bash
yarn workspace @webstackbuilders/backstage-plugin-ai-core-backend-module-collaboration test
```

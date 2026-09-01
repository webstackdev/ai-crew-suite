# @webstackbuilders/plugin-ai-core-backend-module-communication-slack

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

Registers a Slack `CommunicationDriver` with
`@webstackbuilders/plugin-ai-core-backend-module-communication` through the
`communicationDriversExtensionPoint`. This package owns Slack Web API access and
response mapping; the core module owns the tool surface.

## Configuration

```yaml
ai:
  integrations:
    communication:
      provider: slack
      slack:
        token: ${SLACK_BOT_TOKEN}
        workspaceDomain: my-org.slack.com
```

Required bot token scopes: `channels:read`, `groups:read`, `channels:history`,
`groups:history`, and `chat:write`.

## Installation

```ts
backend.add(
  loadBackendFeature(
    import('@webstackbuilders/plugin-ai-core-backend-module-communication-slack'),
  ),
);
```

## Local Development Workflow

```bash
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-communication-slack build
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-communication-slack test
```

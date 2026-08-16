# @webstackbuilders/plugin-ai-core-backend-module-collaboration-slack

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

Registers a Slack `MessagingProviderDriver` with
`@webstackbuilders/plugin-ai-core-backend-module-collaboration` through the
`messagingDriversExtensionPoint`. This package owns Slack Web API access and
mapping; the core module owns the tool surface.

## Configuration

```yaml
ai:
  integrations:
    collaboration:
      messaging: slack
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
    import('@webstackbuilders/plugin-ai-core-backend-module-collaboration-slack'),
  ),
);
```

## Local Development Workflow

```bash
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-collaboration-slack build
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-collaboration-slack test
```

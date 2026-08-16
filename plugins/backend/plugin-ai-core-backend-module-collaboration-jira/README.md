# @webstackbuilders/plugin-ai-core-backend-module-collaboration-jira

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

Registers a Jira Cloud `TicketProviderDriver` with
`@webstackbuilders/plugin-ai-core-backend-module-collaboration` through the
`ticketDriversExtensionPoint`. This package owns Jira API access and mapping; the
core module owns the tool surface.

## Configuration

```yaml
ai:
  integrations:
    collaboration:
      ticketing: jira
      jira:
        baseUrl: https://my-org.atlassian.net
        email: ${JIRA_EMAIL}
        apiToken: ${JIRA_API_TOKEN}
        defaultProjectKey: OPS
        defaultIssueType: Task
```

The API token is authenticated with HTTP basic auth against the Jira Cloud REST
API v3. Grant the token only the project scopes the agents need to read and
write.

## Installation

```ts
backend.add(
  loadBackendFeature(
    import('@webstackbuilders/plugin-ai-core-backend-module-collaboration-jira'),
  ),
);
```

## Local Development Workflow

```bash
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-collaboration-jira build
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-collaboration-jira test
```

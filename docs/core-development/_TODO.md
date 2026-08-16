# Todo List

## Implement sibling plugins

### `backstage-plugin-ai-incident-management`

- PagerDuty
- Opsgenie

### `backstage-plugin-ai-observability`

- Datadog
- New Relic
- Splunk
- OpenTelemetry
- Jaeger

### `backstage-plugin-ai-project-management`

- Jira
- Linear

### `backstage-plugin-ai-communication`

- Slack
- Microsoft Teams

## Service-Account Tokens

Are we pulling credentials for sibling third-party service implementations from that plugin? For example, when we interact with GitHub through `plugin-ai-core-backend-module-vcs-github`, the user will probably be using the `@backstage/plugin-catalog-backend-module-github` plugin as well. Are we pulling credentials from that @backstage plugin if it's set there? Should we be doing that? Presumably that token is read / write, and we probably only need read access for our agentic plugins. So maybe there should be an option to set it in our plugin config vs. pulling it from the primary plugin? And how about for User Auth Tokens?

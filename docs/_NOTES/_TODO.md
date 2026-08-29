# Todo List

## Implement sibling plugins

### `backstage-plugin-ai-incident-management`

- Opsgenie

### `backstage-plugin-ai-observability`

- New Relic
- Splunk
- OpenTelemetry
- Jaeger
- Prometheus

### `backstage-plugin-ai-project-management`

- Linear

### `backstage-plugin-ai-communication`

- Microsoft Teams

## Service-Account Tokens

Choosing between Backstage **Auth Providers** (user-delegated auth via the user's token for a platform like GitHub) and **Service-Account Tokens** (app-level auth) is one of the most critical decisions for agentic workflows.

Because your plugins power **AI agents** that act on behalf of users or infrastructure, the choice impacts security, auditability, and what the agent is allowed to do.

## Backstage Auth Providers (User Token Flow)

This approach authenticates the individual Backstage user using OAuth2.0. The agent acts explicitly **on behalf of that specific logged-in user**.

**How it works:** When a user triggers an agentic workflow (like `kubernetes-ai-responder`), Backstage uses its `AuthAPI` to request an OAuth token for that user (e.g., their personal GitHub, Slack, or Jira token) and forwards it to the plugin.

### **Pros**

- **Inherited Permissions:** The AI agent can only see and touch what that exact user has access to. A junior engineer cannot accidentally use an agent to delete a production database via Datadog.
- **Perfect Auditing:** Third-party system logs will show *"Action performed by Jane Doe via Backstage App."*

### **Cons**

- **Background Failure:** AI agents running on background crons or webhooks (like `alert-ai-tuner` scanning logs at 2:00 AM) will **fail** because there is no logged-in user to provide a token.
- **Token Expiration:** If a workflow takes a long time, the user's OAuth token might expire mid-execution.

## Service-Account Tokens (App-Level Flow)

This approach uses a single, centralized credential (API key, App Token, or Client Secret) hardcoded into the Backstage backend configuration (`app-config.yaml`).

**How it works:** The agent bypasses user identity completely. It talks to PagerDuty, Slack, or Datadog using a master "Backstage Bot" account.

### **Pros**

- **Always Available:** Perfect for autonomous or asynchronous agents (e.g., `oncall-ai-handover-assistant` compiling data automatically at shift change).
- **Simpler Setup:** Users do not have to continuously log into external tools inside Backstage.

### **Cons**

- **Over-Privileged AI:** The agent typically operates with broad admin or read-all access. A prompt-injection attack or an AI hallucination could lead to data leaks or unintended actions across the entire company.
- **Poor Auditing:** Every single action in Jira or Slack looks like it was done by `backstage-bot`, hiding who actually prompted the AI.

## The Verdict: A Hybrid Strategy for AI Agents

For agentic workflows, you usually cannot choose just one. You should apply them based on the **nature of the plugin**:

| Plugin Type | Recommended Auth Method | Reason |
| --- | --- | --- |
| **Observability** (`datadog`, `splunk`) | **Service-Account** | Agents need to read raw infrastructure metrics and logs. Individual user tokens for tools like Splunk are notoriously difficult to manage or restrict. |
| **Incident Management** (`pagerduty`) | **Service-Account** (Read) / **User Auth** (Write) | Reading who is on call can use a bot token. Acknowledge, resolve, or override actions should require the user's token. |
| **Project Management** (`jira`) | **User Auth** | AI agents creating or assigning tickets must do so under the author's real identity for accurate project history. |
| **Communication** (`slack`) | **Hybrid:** **Service-Account** / **User Auth** | Bot tokens are best for posting automated summaries to public channels. User tokens are required if the agent needs to read private DMs or post *as* the user. |

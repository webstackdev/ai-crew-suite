# Collaboration Provider Notes

## Planned Agentic Workflow Plugins Consuming Collaboration Sibling Plugins

## Ticket Management-like Services

Jira, Linear, Basecamp, GitHub Projects, GitLab Issues, Asana

- `oncall-ai-handover-assistant`: Jira, Linear, and similar plugins used to check for outstanding high-severity incident tickets or ongoing production fire items still assigned to the on-call queue.
- `release-notes-ai-generator`: Jira, Linear, and similar plugins cross-referenced by the agent to translate cryptic PR titles into descriptive customer feature terms by reading the associated epic or user story description fields.
- `search-ai-archeology`: Jira, Linear, and similar used to query old ticket comment histories and assignee loops attached to legacy component identifiers.
- `scaffolder-ai-prd`: Jira, Linear, and similar invoked by the PM node to create tracking buckets, map story points, and establish dependency lines.
- `tech-debt-ai-scout`: Jira, Linear, and similar are the primary outward-facing tracking targets where the agent opens tasks for engineering teams.

## Communication-like Services

- `scaffolder-ai-shadow-detective`: Slack and similar utilized to deliver interactive triage notifications directly to team workspace channels.
- `techdocs-ai-postmortem`: Slack and similar provide contextual team message transcripts.

# Observability Provider Notes

## Planned Agentic Workflow Plugins Consuming Observability Sibling Plugins

The following proposed agentic workflow plugins consume this plugin:

- `alert-ai-tuner`: PagerDuty, Opsgenie, and similar provide the history of triggered alerts, including timestamps for when they opened and closed, and whether they were resolved automatically or manually.
- `catalog-ai-insights`: PagerDuty, Opsgenie, and similar provide the source data for _"Who is the on-call?"_.
- `catalog-ai-insights`: Datadog, New Relic, Splunk, and similar provide dashboard links or recent error log anomalies.
- `kubernetes-ai-responder`: Datadog, OpenTelemetry, Jaeger, and similar provide API hooks to scan recent distributed trace anomalies or error-rate spikes matching the failing service's timeline.
- `oncall-ai-handover-assistant`: PagerDuty, Opsgenie, and similar provide the volume of alerts, specific alert definitions, and paging event metadata triggered during the departing shift.
- `scaffolder-ai-prd`: Jira, Linear, and similar invoked by the PM node to create tracking buckets, map story points, and establish dependency lines.
- `search-ai-archeology`: Jira, Linear, and similar used to query old ticket comment histories and assignee loops attached to legacy component identifiers.
- `tech-debt-ai-scout`: Jira, Linear, and similar are the primary outward-facing tracking targets where the agent opens tasks for engineering teams.
- `techdocs-ai-postmortem`: PagerDuty, Opsgenie, and similar provides the baseline incident metrics (start/end timestamps, team assignment, core responder notes).
- `techdocs-ai-postmortem`: Datadog, Splunk, and similar are extracted by the Log Gatherer node to identify error spikes or alert triggers.

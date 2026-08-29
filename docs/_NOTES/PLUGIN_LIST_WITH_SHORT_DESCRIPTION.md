# List of AI Crew Suite Plugins

## Alert AI Tuner (`plugin-ai-agent-backend-alert-ai-tuner`)

This plugin analyzes alerting matrices to suppress noisy or redundant indicators automatically. An agent monitors your PagerDuty or Opsgenie alerts. If an alert is triggered but consistently closed without any code changes or manual action (false positives), the agent opens a PR to your Terraform repository to tweak the threshold of that specific Prometheus alert.

## Catalog AI Insights (`plugin-ai-agent-backend-catalog-ai-insights`)

This plugin leverages large language models to analyze catalog entity relations and auto-generate structural engineering summaries. Provides general operational Q\&A about catalog entities in response to manual questions and scheduled scans. Utilizes a broad toolset including knowledge retrieval, VCS, observability, and incidents.

## Kubernetes AI Responder (`plugin-ai-agent-backend-kubernetes-ai-responder`)

This plugin interfaces with active Kubernetes infrastructure to parse error states, investigate pod logs, and serve real-time remediation playbooks. It provides failure classification and evidence planning for incident response. Fetches recent commits and pull requests for the component's repository to identify deployments that correlate with the incident window. Scans traces, logs, and error-rate signals matching the failure timeline from observability platforms. Uses AlertManager webhooks for real-time incident response.

## Oncall AI Handover Assistant (`plugin-ai-agent-backend-oncall-ai-handover-assistant`)

This plugin automates the collection of shift events, unresolved alerts, and systemic notes to generate structured summary briefs for incoming on-call engineers. 

## Release Notes AI Generator (`plugin-ai-agent-backend-release-notes-ai-generator`)

This plugin analyzes branch diffs, commit histories, and pull request bodies to automatically generate release notes tailored for product teams and stakeholders. Cross-references Jira, Linear, and similar platforms to translate cryptic PR titles into descriptive customer feature terms by reading the associated epic or user story description fields.

## RFC ADR AI Reviewer (`plugin-ai-agent-backend-rfc-adr-ai-reviewer`)

This plugin automatically parses Request for Comments (RFCs) and Architecture Decision Records (ADRs) to flag design pattern deviations, security anomalies, and dependency mismatches. A "Senior Architect" Agent Node extracts the system design proposals and cross-references them against live catalog dependencies and active API schemas. Concurrently, a "Security Lead" Agent Node parses the document against enterprise compliance rules.

## Scaffolder AI Drift Detector (`plugin-ai-agent-backend-scaffolder-ai-drift-detector`)

This plugin continuously scans repositories created via software templates to identify deviations, outdated configurations, and non-compliant pattern drift over time.

## Scaffolder AI Guardrail Agent (`plugin-ai-agent-backend-scaffolder-ai-guardrail-agent`)

This plugin sits directly inside your software template wizard pipelines, running active compliance validation steps before any cloud resource provisioning or repository scaffolding takes place. Focuses on compliance validation (policies, budgets, architecture).

## Scaffolder AI Infra (`plugin-ai-agent-backend-scaffolder-ai-infra`)

This plugin automatically generates Infrastructure as Code (IaC) files matching your organization's compliance blueprints directly during the project scaffolding step. Focuses on IaC code generation (Terraform/CloudFormation).

## Scaffolder AI Intent (`plugin-ai-agent-backend-scaffolder-ai-intent`)

This plugin analyzes natural language intent inputs from users to automatically select, pre-fill, and execute appropriate software template blueprints.

## Scaffolder AI PRD (`plugin-ai-agent-backend-scaffolder-ai-prd`)

This plugin automatically parses Product Requirement Documents (PRDs) and translates them into actionable engineering templates and task definitions during the scaffolding phase.

## Scaffolder AI Shadow Detective (`plugin-ai-agent-backend-scaffolder-ai-shadow-detective`)

This plugin audits deployed infrastructure assets against the Software Catalog, actively identifying orphaned or undocumented cloud resources that lack matching Scaffolder ancestry records.

## Search AI Archeology (`plugin-ai-agent-backend-search-ai-archeology`)

Find subject matter experts through ticket/triage history analysis. This plugin acts as a semantic search engine across deprecated spaces, legacy wikis, and historical repositories, digging up context and documentation that keyword search engines miss. Outputs ranked experts and familiarity scores.

## Search AI Context (`plugin-ai-agent-backend-search-ai-context`)

Technical / architectural dependency analysis. This plugin connects isolated documentation silos across disparate tools and messaging spaces to surface contextually relevant, unified engineering answers natively inside Backstage.

## Tech Debt AI Scout (`plugin-ai-agent-backend-tech-debt-ai-scout`)

This plugin systematically crawls your code repositories to automatically map, prioritize, and surface code rot, deprecated library usages, and complex technical debt hotspots.

## Techdocs AI Janitor (`plugin-ai-agent-backend-techdocs-ai-janitor`)

This plugin automatically parses your markdown documentation trees to identify and patch out-of-date setup commands, dead external URLs, and stale code syntax patterns. Instead of analyzing code files in a vacuum, the plugin utilizes the **Backstage Software Catalog**, **Search Telemetry**, and **TechDocs storage buckets** to autonomously detect architectural drift, heal broken ecosystem links, map shifting team ownership, and proactively resolve documentation gaps across the entire enterprise.

## Techdocs AI Postmortem (`plugin-ai-agent-backend-techdocs-ai-postmortem`)

This plugin aggregates timeline sequences from Slack channels, incident management systems, and monitoring platforms to automatically draft comprehensive post-mortem incidents.


## Tech Radar AI Manager (`plugin-ai-agent-backend-tech-radar-ai-manager`)

This plugin continuously scans internal repositories and software lifecycle telemetry to automatically recommend status promotions or deprecations on your company's Technology Radar.


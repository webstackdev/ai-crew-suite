Tier 1: Core Architecture & Infrastructure

Core Platform Tools

- `core/backend` \(\rightarrow \) **`@ai-crew-suite/plugin-core-backend`** (Main core backend plugin)
- `core/node` \(\rightarrow \) **`@ai-crew-suite/plugin-core-node`** (Shared Node.js library for core plugin extension points)

Infrastructure Engine Plugins (Core + Modules)

For infrastructure, the `*-core` package acts as the host backend plugin (`plugin-infra-llm-backend`), and each specific vendor directory becomes a **Backend Module** targeting that plugin.

- `infra/llm/core` \(\rightarrow \) **`@ai-crew-suite/plugin-infra-llm-backend`**
- `infra/llm/aws` \(\rightarrow \) **`@ai-crew-suite/plugin-infra-llm-backend-module-aws`**
- `infra/llm/openai` \(\rightarrow \) **`@ai-crew-suite/plugin-infra-llm-backend-module-openai`**
- `infra/llm/openrouter` \(\rightarrow \) **`@ai-crew-suite/plugin-infra-llm-backend-module-openrouter`**
- `infra/vector/core` \(\rightarrow \) **`@ai-crew-suite/plugin-infra-vector-backend`**
- `infra/vector/pgvector` \(\rightarrow \) **`@ai-crew-suite/plugin-infra-vector-backend-module-pgvector`**
- `infra/vector/qdrant` \(\rightarrow \) **`@ai-crew-suite/plugin-infra-vector-backend-module-qdrant`**
- `infra/retrieval-augmenter` \(\rightarrow \) **`@ai-crew-suite/plugin-infra-retrieval-augmenter-backend`**
- `infra/runtime-store` \(\rightarrow \) **`@ai-crew-suite/plugin-infra-runtime-store-backend`**

------

Tier 2: Agentic Workflow Pairs

Frontend Library

- `core-frontend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-core-react`** (Or `-frontend`. Backstage standard leans heavily toward `-react` or `-node` for shared library utilities).

Feature-Pair Plugins

Every individual feature split cleanly into frontend/backend code gets explicitly isolated naming.

- `alert-tuner/backend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-alert-tuner-backend`**
- `alert-tuner/frontend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-alert-tuner`**
- `catalog-insights/backend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-catalog-insights-backend`**
- `catalog-insights/frontend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-catalog-insights`**
- `kubernetes-responder/backend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-kubernetes-responder-backend`**
- `kubernetes-responder/frontend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-kubernetes-responder`**
- `oncall-handover/backend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-oncall-handover-backend`**
- `oncall-handover/frontend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-oncall-handover`**
- `release-notes-generator/backend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-release-notes-generator-backend`**
- `release-notes-generator/frontend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-release-notes-generator`**
- `rfc-adr-reviewer/backend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-rfc-adr-reviewer-backend`**
- `rfc-adr-reviewer/frontend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-rfc-adr-reviewer`**
- `scaffolder-drift-detector/backend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-scaffolder-drift-detector-backend`**
- `scaffolder-drift-detector/frontend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-scaffolder-drift-detector`**
- `scaffolder-guardrail/backend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-scaffolder-guardrail-backend`**
- `scaffolder-guardrail/frontend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-scaffolder-guardrail`**
- `scaffolder-infra/backend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-scaffolder-infra-backend`**
- `scaffolder-infra/frontend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-scaffolder-infra`**
- `scaffolder-intent/backend` \(\rightarrow;\)** **`@ai-crew-suite/plugin-agent-scaffolder-intent-backend`**
- `scaffolder-intent/frontend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-scaffolder-intent`**
- `scaffolder-prd/backend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-scaffolder-prd-backend`**
- `scaffolder-prd/frontend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-scaffolder-prd`**
- `scaffolder-shadow-detective/backend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-scaffolder-shadow-detective-backend`**
- `scaffolder-shadow-detective/frontend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-scaffolder-shadow-detective`**
- `search-archeology/backend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-search-archeology-backend`**
- `search-archeology/frontend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-search-archeology`**
- `search-context/backend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-search-context-backend`**
- `search-context/frontend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-search-context`**
- `tech-debt-scout/backend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-tech-debt-scout-backend`**
- `tech-debt-scout/frontend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-tech-debt-scout`**
- `techdocs-janitor/backend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-techdocs-janitor-backend`**
- `techdocs-janitor/frontend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-techdocs-janitor`**
- `techdocs-postmortem/backend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-techdocs-postmortem-backend`**
- `techdocs-postmortem/frontend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-techdocs-postmortem`**
- `tech-radar-manager/backend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-tech-radar-manager-backend`**
- `tech-radar-manager/frontend` \(\rightarrow \) **`@ai-crew-suite/plugin-agent-tech-radar-manager`**

------

Tier 3: Third-Party Vendor Integration Plugins

Because your tools are strictly backend plugins, the `core` package hosts the plugin ecosystem (`plugin-tool-*-backend`), and individual provider extensions map perfectly to Backstage's **Backend Modules** layout scheme.

Cloud Providers

- `cloud-providers/core` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-cloud-providers-backend`**
- `cloud-providers/aws` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-cloud-providers-backend-module-aws`**
- `cloud-providers/azure` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-cloud-providers-backend-module-azure`**
- `cloud-providers/gcp` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-cloud-providers-backend-module-gcp`**

Communication

- `communication/core` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-communication-backend`**
- `communication/slack` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-communication-backend-module-slack`**

Compliance

- `compliance/core` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-compliance-backend`**
- `compliance/opa` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-compliance-backend-module-opa`**

Incident Management

- `incident-management/core` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-incident-management-backend`**
- `incident-management/pagerduty` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-incident-management-backend-module-pagerduty`**

Kubernetes (Self-Contained)

- `kubernetes/` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-kubernetes-backend`**

Observability

- `observability/core` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-observability-backend`**
- `observability/datadog` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-observability-backend-module-datadog`**

Project Management

- `project-management/core` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-project-management-backend`**
- `project-management/jira` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-project-management-backend-module-jira`**

Quality Scorecards

- `quality-scorecards/core` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-quality-scorecards-backend`**
- `quality-scorecards/scorecards` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-quality-scorecards-backend-module-scorecards`**
- `quality-scorecards/soundcheck` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-quality-scorecards-backend-module-soundcheck`**
- `quality-scorecards/techradar` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-quality-scorecards-backend-module-techradar`**

VCS (Version Control Systems)

- `vcs/core` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-vcs-backend`**
- `vcs/aws-codecommit` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-vcs-backend-module-aws-codecommit`**
- `vcs/azure` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-vcs-backend-module-azure`**
- `vcs/bitbucket` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-vcs-backend-module-bitbucket`**
- `vcs/gerrit` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-vcs-backend-module-gerrit`**
- `vcs/git` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-vcs-backend-module-git`**
- `vcs/github` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-vcs-backend-module-github`**
- `vcs/gitlab` \(\rightarrow \) **`@ai-crew-suite/plugin-tool-vcs-backend-module-gitlab`**
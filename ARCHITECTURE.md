# AI Crew Suite — Monorepo Architecture Guide

Welcome to the **AI Crew Suite** monorepo. This project uses a **Turborepo** monorepo workspace structure to manage our agentic workflow plugins, core orchestration services, and tool abstractions. 

This document defines our hard standards for directory layouts, package naming conventions, and architectural boundaries.

## 🏗️ Architectural Foundations

Our monorepo splits code into three isolated tiers:

1. **Core Orchestration & Infra:** The underlying LangGraph workflow engine, shared Node runtimes, and foundational infrastructure drivers (LLMs, Vector Storage).
2. **Agents:** End-user facing agent workflows, paired cleanly into frontend and backend packages.
3. **Tools:** Standardized interfaces allowing our agents to communicate with third-party software (VCS, Project Management, Slack).

All internal packages belong to the NPM organization scope `@ai-crew-suite`.

## Leaf Plugin Files

### `tsconfig.json`

```json
{
  "extends": "../../../../tsconfig.base.json",
}
```

### `package.json`

```json
{
  "name": "@ai-crew-suite/agent-alert-tuner-backend",
  "scripts": {
    "build": "tsc",
    "clean": "rimraf dist",
    "lint": "eslint src --max-warnings 0",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@ai-crew-suite/config-eslint": "workspace:*",
    "@ai-crew-suite/config-vitest": "workspace:*",
    "@backstage/backend-test-utils": "backstage:^",
    "@backstage/cli": "backstage:^",
    "@types/node": "catalog:node-types",
    "rimraf": "catalog:rimraf",
    "typescript": "catalog:typescript",
    "vitest": "catalog:vitest"
  }
}
```

Use this as the standard per-package lint script pattern during your refactor:

Use one command shape everywhere:

`"lint": "ai-crew-eslint --role <role> src --max-warnings 0"`

The supported canonical `--role` values are defined in `index.ts`:

- `node-library`
  Use for server-side libraries, config packages, utility packages, and anything Node-only.
- `web-library`
  Use for browser/UI libraries that are not full Backstage plugins.
- `backend`
  Use for a backend app/package.
- `backend-plugin`
  Use for Backstage backend plugins.
- `backend-plugin-module`
  Use for backend plugin modules/extensions.
- `frontend`
  Use for a frontend app/package.
- `frontend-plugin`
  Use for Backstage frontend plugins.
- `frontend-plugin-module`
  Use for frontend plugin modules/extensions.
- `cli`
  Use for command-line packages.
- `cli-module`
  Use for CLI extension/module packages.
- `common-library`
  This exists, but I would not use it yet. In the current implementation it does not get the frontend/browser branch you’d probably expect, so it behaves like base TS-only config unless you fix that in `index.ts`.

There are also two aliases in `ai-crew-eslint.mjs`:

- `--role node` maps to `node-library`
- `--role web` maps to `web-library`

For consistency across 60+ packages, I would use the full canonical names, not the aliases.

Practical repo mapping:

- `packages/config-*`, `packages/backend-*`, `scripts`, Node-only shared libs: `node-library`
- `app`: `frontend`
- frontend plugin packages under `plugins/.../frontend`: `frontend-plugin`
- backend plugin packages under `plugins/.../backend`: `backend-plugin`
- browser-focused shared packages like Storybook helpers or UI libs: `web-library`

One special case remains:

`"lint": "node ./bin/ai-crew-eslint.mjs --role node-library src --max-warnings 0"`

That one is only for `package.json`, because a package cannot reliably invoke its own workspace bin by name in its own script environment.

The wrapper forwards the rest of the args straight to ESLint, so if a package doesn’t lint `src`, you can swap that part only:

`"lint": "ai-crew-eslint --role frontend-plugin . --max-warnings 0"`

If you want, I can also give you a short role-to-path cheat sheet for all the package/plugin directory patterns in this repo.

If you manually roll this out elsewhere, the current model is:

Consumers use `ai-crew-eslint --role <role> src --max-warnings 0`

The shared package owns all config logic and emits runnable JS from src into dist

### Run Unit Tests in a Plugin

```bash
yarn turbo run build --filter=@ai-crew-suite/config-eslint
yarn turbo run lint --filter=@ai-crew-suite/config-eslint
yarn turbo run test:unit --filter=@ai-crew-suite/config-eslint
```

**Yarn `catalog:` Protocol**

**Leaf Plugin `package.json`**

Down inside your 60+ plugins, you declare the dependency versions by pointing to your catalog token instead of writing raw strings:

```json
{
  "name": "@ai-crew-suite/agent-alert-tuner-backend",
  "devDependencies": {
    "@types/node": "catalog:toolchain",
    "eslint": "catalog:toolchain",
    "rimraf": "catalog:toolchain",
    "typescript": "catalog:toolchain",
    "vitest": "catalog:toolchain"
  }
}
```

## 📁 Repository Directory Structure

```text
ai-crew-suite/
├── .github/
│   ├── actions/
│   │   ├── require-playwright-success/
│   │   └── validate-monorepo-architecture/ # Your custom Python linting action
│   └── workflows/
│       └── lint-architecture.yml
├── apps/
│   └── backstage/                          # Main Backstage app instance
├── docs/
│   └── ARCHITECTURE.md                     # Monorepo architecture standards file
├── plugins/
│   ├── core/                               # TIER 1: CORE ARCHITECTURE & INFRASTRUCTURE
│   │   ├── backend/                        # @ai-crew-suite/core-backend
│   │   ├── node/                           # @ai-crew-suite/core-node
│   │   └── infra/                          # Foundational LangGraph framework engine pieces
│   │       ├── llm/
│   │       │   ├── core/                   # @ai-crew-suite/infra-llm-core
│   │       │   ├── aws/                    # @ai-crew-suite/infra-llm-aws
│   │       │   ├── openai/                 # @ai-crew-suite/infra-llm-openai
│   │       │   └── openrouter/             # @ai-crew-suite/infra-llm-openrouter
│   │       ├── vector/
│   │       │   ├── core/                   # @ai-crew-suite/infra-vector-core
│   │       │   ├── pgvector/               # @ai-crew-suite/infra-vector-pgvector
│   │       │   └── qdrant/                 # @ai-crew-suite/infra-vector-qdrant
│   │       ├── retrieval-augmenter/        # @ai-crew-suite/infra-retrieval-augmenter
│   │       └── runtime-store/              # @ai-crew-suite/infra-runtime-store
│   │
│   ├── agents/                             # TIER 2: AGENTIC WORKFLOW PAIRS (18 Agents + Core UI)
│   │   ├── core-frontend/                  # @ai-crew-suite/agent-core-frontend
│   │   ├── alert-tuner/
│   │   │   ├── backend/                    # @ai-crew-suite/agent-alert-tuner-backend
│   │   │   └── frontend/                   # @ai-crew-suite/agent-alert-tuner-frontend
│   │   ├── catalog-insights/
│   │   │   ├── backend/                    # @ai-crew-suite/agent-catalog-insights-backend
│   │   │   └── frontend/                   # @ai-crew-suite/agent-catalog-insights-frontend
│   │   ├── kubernetes-responder/
│   │   │   ├── backend/                    # @ai-crew-suite/agent-kubernetes-responder-backend
│   │   │   └── frontend/                   # @ai-crew-suite/agent-kubernetes-responder-frontend
│   │   ├── oncall-handover/
│   │   │   ├── backend/                    # @ai-crew-suite/agent-oncall-handover-backend
│   │   │   └── frontend/                   # @ai-crew-suite/agent-oncall-handover-frontend
│   │   ├── release-notes-generator/
│   │   │   ├── backend/                    # @ai-crew-suite/agent-release-notes-generator-backend
│   │   │   └── frontend/                   # @ai-crew-suite/agent-release-notes-generator-frontend
│   │   ├── rfc-adr-reviewer/
│   │   │   ├── backend/                    # @ai-crew-suite/agent-rfc-adr-reviewer-backend
│   │   │   └── frontend/                   # @ai-crew-suite/agent-rfc-adr-reviewer-frontend
│   │   ├── scaffolder-drift-detector/
│   │   │   ├── backend/                    # @ai-crew-suite/agent-scaffolder-drift-detector-backend
│   │   │   └── frontend/                   # @ai-crew-suite/agent-scaffolder-drift-detector-frontend
│   │   ├── scaffolder-guardrail/
│   │   │   ├── backend/                    # @ai-crew-suite/agent-scaffolder-guardrail-backend
│   │   │   └── frontend/                   # @ai-crew-suite/agent-scaffolder-guardrail-frontend
│   │   ├── scaffolder-infra/
│   │   │   ├── backend/                    # @ai-crew-suite/agent-scaffolder-infra-backend
│   │   │   └── frontend/                   # @ai-crew-suite/agent-scaffolder-infra-frontend
│   │   ├── scaffolder-intent/
│   │   │   ├── backend/                    # @ai-crew-suite/agent-scaffolder-intent-backend
│   │   │   └── frontend/                   # @ai-crew-suite/agent-scaffolder-intent-frontend
│   │   ├── scaffolder-prd/
│   │   │   ├── backend/                    # @ai-crew-suite/agent-scaffolder-prd-backend
│   │   │   └── frontend/                   # @ai-crew-suite/agent-scaffolder-prd-frontend
│   │   ├── scaffolder-shadow-detective/
│   │   │   ├── backend/                    # @ai-crew-suite/agent-scaffolder-shadow-detective-backend
│   │   │   └── frontend/                   # @ai-crew-suite/agent-scaffolder-shadow-detective-frontend
│   │   ├── search-archeology/
│   │   │   ├── backend/                    # @ai-crew-suite/agent-search-archeology-backend
│   │   │   └── frontend/                   # @ai-crew-suite/agent-search-archeology-frontend
│   │   ├── search-context/
│   │   │   ├── backend/                    # @ai-crew-suite/agent-search-context-backend
│   │   │   └── frontend/                   # @ai-crew-suite/agent-search-context-frontend
│   │   ├── tech-debt-scout/
│   │   │   ├── backend/                    # @ai-crew-suite/agent-tech-debt-scout-backend
│   │   │   └── frontend/                   # @ai-crew-suite/agent-tech-debt-scout-frontend
│   │   ├── techdocs-janitor/
│   │   │   ├── backend/                    # @ai-crew-suite/agent-techdocs-janitor-backend
│   │   │   └── frontend/                   # @ai-crew-suite/agent-techdocs-janitor-frontend
│   │   ├── techdocs-postmortem/
│   │   │   ├── backend/                    # @ai-crew-suite/agent-techdocs-postmortem-backend
│   │   │   └── frontend/                   # @ai-crew-suite/agent-techdocs-postmortem-frontend
│   │   └── tech-radar-manager/
│   │       ├── backend/                    # @ai-crew-suite/agent-tech-radar-manager-backend
│   │       └── frontend/                   # @ai-crew-suite/agent-tech-radar-manager-frontend
│   │
│   └── tools/                              # TIER 3: THIRD-PARTY VENDOR INTEGRATION PLUGINS
│       ├── cloud-providers/
│       │   ├── core/                       # @ai-crew-suite/tool-cloud-providers-core
│       │   ├── aws/                        # @ai-crew-suite/tool-cloud-providers-aws
│       │   ├── azure/                      # @ai-crew-suite/tool-cloud-providers-azure
│       │   └── gcp/                        # @ai-crew-suite/tool-cloud-providers-gcp
│       ├── communication/
│       │   ├── core/                       # @ai-crew-suite/tool-communication-core
│       │   └── slack/                      # @ai-crew-suite/tool-communication-slack
│       ├── compliance/
│       │   ├── core/                       # @ai-crew-suite/tool-compliance-core
│       │   └── opa/                        # @ai-crew-suite/tool-compliance-opa
│       ├── incident-management/
│       │   ├── core/                       # @ai-crew-suite/tool-incident-management-core
│       │   └── pagerduty/                  # @ai-crew-suite/tool-incident-management-pagerduty
│       ├── kubernetes/                     # @ai-crew-suite/tool-kubernetes (Self-contained driver)
│       ├── observability/
│       │   ├── core/                       # @ai-crew-suite/tool-observability-core
│       │   └── datadog/                    # @ai-crew-suite/tool-observability-datadog
│       ├── project-management/
│       │   ├── core/                       # @ai-crew-suite/tool-project-management-core
│       │   └── jira/                       # @ai-crew-suite/tool-project-management-jira
│       ├── quality-scorecards/
│       │   ├── core/                       # @ai-crew-suite/tool-quality-scorecards-core
│       │   ├── scorecards/                 # @ai-crew-suite/tool-quality-scorecards-scorecards
│       │   ├── soundcheck/                 # @ai-crew-suite/tool-quality-scorecards-soundcheck
│       │   └── techradar/                  # @ai-crew-suite/tool-quality-scorecards-techradar
│       └── vcs/
│           ├── core/                       # @ai-crew-suite/tool-vcs-core
│           ├── aws-codecommit/             # @ai-crew-suite/tool-vcs-aws-codecommit
│           ├── azure/                      # @ai-crew-suite/tool-vcs-azure
│           ├── bitbucket/                  # @ai-crew-suite/tool-vcs-bitbucket
│           ├── gerrit/                     # @ai-crew-suite/tool-vcs-gerrit
│           ├── git/                        # @ai-crew-suite/tool-vcs-git
│           ├── github/                     # @ai-crew-suite/tool-vcs-github
│           └── gitlab/                     # @ai-crew-suite/tool-vcs-gitlab
│
├── package.json                            # Root monorepo metadata
└── turbo.json                              # Pipelines orchestration profile

```

## 🏷️ Package Naming Conventions

To keep our workspace clean and highly predictable, all package.json names must rigidly follow these prefixes and rules:

### 1. Agents (Workflow Plugins)

Every agent consists of a co-located frontend and backend folder under `plugins/agents/[domain]`.

* **Pattern:** `@ai-crew-suite/agent-[domain]-[purpose]-[backend|frontend]`
* **Rules:** Eliminate any redundant use of ai in the purpose string.
* *Example:* `@ai-crew-suite/agent-alert-tuner-backend`

### 2. Tools & Infrastructure (The Registry/Provider Split)

Both Tools (`plugins/tools/`) and Infrastructure (`plugins/core/infra/`) follow a decoupled **Hub and Spoke** pattern. We explicitly separate the orchestration hub from individual vendor integrations.

#### A. The Registry / Factory Hub (-core)

The parent directory contains a core / folder acting as a driver registry and tool factory coordinator. It exposes the Backstage extension points and compiles tools from configuration.

* **Pattern (Tools):** `@ai-crew-suite/tool-[domain]-core`
* **Pattern (Infra):** `@ai-crew-suite/infra-[domain]-core`
* *Examples:* `@ai-crew-suite/tool-vcs-core`, `@ai-crew-suite/infra-vector-core`

#### B. The Pure Driver Suppliers

Satellite folders represent the standalone vendor plugins. They handle credential resolution, instantiate concrete classes, and register themselves directly to the -core hub's extension point.

* **Pattern (Tools):** `@ai-crew-suite/tool-[domain]-[provider]`
* **Pattern (Infra):** `@ai-crew-suite/infra-[domain]-[provider]`
* *Examples:* `@ai-crew-suite/tool-vcs-github`, `@ai-crew-suite/infra-vector-pgvector`

## 🛑 Architectural Rules

1. **No Circular Dependencies:** `tools` may never depend on `agents`. `infra` may never depend on tools.
2. **Pure Providers:** Satellite driver modules (e.g., `tool-vcs-github`) should strictly register their implementation to their respective hub extension point and side-effect nothing else.
3. **No Root Clutter:** Do not flatten domain integrations into the root of `plugins/tools/`. Keep them neatly grouped inside subdirectories (e.g., `plugins/tools/vcs/*`).

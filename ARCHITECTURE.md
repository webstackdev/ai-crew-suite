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

```bash
find . -type f -exec sed -i 's|https://github.com/ai-crew-suite|https://github.com/ai-crew-suite|g' {} +
```

### `tsconfig.json`

```json
{
  "extends": "../../../../tsconfig.base.json",
}
```

```bash
@ai-crew-suite/core-node
```

### `package.json`

```json
{
  "name": "@ai-crew-suite/agent-alert-tuner-backend",
  "description": "",
  "version": "1.0.0",
  "type": "module", // frontend plugins only
  "main": "src/index.ts",
  "types": "src/index.ts",
  "license": "Apache-2.0",
  "keywords": [
    "ai-core",
    "ai-crew-suite",
    "backend",
    "backstage-plugin-module",
    "backstage",
    "communication"
  ],
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "backstage": {
    "role": "backend-plugin-module",
    "pluginId": "tool-communication",
    "pluginPackages": [
      "@ai-crew-suite/tool-communication-core",
      "@ai-crew-suite/tool-communication-slack"
    ]
  },
  "bugs": {
    "url": "https://github.com/ai-crew-suite/ai-crew-suite/issues",
    "email": "support@ai-crew-suite.dev"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/ai-crew-suite/ai-crew-suite",
    "directory": "plugins/tools/cloud-providers/core"
  },
  "files": [
    "dist/",
    "config.d.ts"
  ],
  "configSchema": "config.d.ts",
  "scripts": {
    "build": "crew build",
    "clean": "crew clean",
    "lint": "crew lint",
    "test:e2e": "crew test:e2e",
    "test:unit": "crew test:unit",
    "test:unit:coverage": "crew test:unit:coverage",
    "typecheck": "crew typecheck"
  },
  "dependencies": {
    "@ai-crew-suite/plugin-ai-core-node": "workspace:^",
  },
  "devDependencies": {
    "@ai-crew-suite/cli": "workspace:*",
    "@backstage/backend-test-utils": "backstage:^",
    "@types/node": "catalog:node-types",
    "react": "catalog:react",
    "react-dom": "catalog:react-dom",
    "typescript": "catalog:typescript",
    "vitest": "catalog:vitest"
  }
}
```

### Run Unit Tests in a Plugin

```bash
yarn turbo run build --filter=@ai-crew-suite/eslint
yarn turbo run lint --filter=@ai-crew-suite/eslint
yarn turbo run test:unit --filter=@ai-crew-suite/eslint
```

When team members join or when you start creating new internal Backstage plugins, the workflow for a new feature branch will look like this:

```bash
# 1. Create a dedicated task branch
git checkout -b feature/my-new-backstage-plugin

# 2. Write your code, tests, and run validations locally
crew typecheck && crew test:unit && crew lint

# 3. When you are ready to commit a release target intent, generate a changeset file
yarn changeset
```

Would you like to set up the **GitHub Actions setup file validation** for your `Changeset PRs` pull request creation workflow next?

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

## Fixing Build

Right now we're mixing `tsc` and `tsc -b` for build scripts across the repo. The `-b` flag duplicates work that Turbo is doing (pushing dependency rebuilds into TypeScript's graph). We should be using `backstage-cli package build`. Backstage's CLI uses Rollup.

However, it uses a global monorepo cache layer located at the root of the project in **`dist-types/`**. Because `backstage-cli package build` relies on the root `dist-types/` cache folder to generate your local type definitions, you must emit type declarations during type checking first. If you run `backstage-cli package build` on a package without running a type check across your monorepo beforehand, the build might fail, or it could bundle outdated type definitions because the global cache was not refreshed.

To ensure your types are always completely synchronized and accurate, your Turborepo task runner should always enforce type emitting *prior* to a full build execution:

1. Run **`yarn tsc`** (or your global typecheck script) at the root level. This compiles type safety across all 60+ packages and populates the root `dist-types/` directory.
2. Run your **`turbo build`** task, which triggers `backstage-cli package build` safely, pulling the fresh types directly from the cached definitions.

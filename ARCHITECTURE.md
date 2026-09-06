# AI Crew Suite — Monorepo Architecture Guide

Welcome to the **AI Crew Suite** monorepo. This project uses a **Turborepo** monorepo workspace structure to manage our agentic workflow plugins, core orchestration services, and tool abstractions. 

This document defines our hard standards for directory layouts, package naming conventions, and architectural boundaries.

## 🏗️ Architectural Foundations

Our monorepo splits code into three isolated tiers:

1. **Core Orchestration & Infra:** The underlying LangGraph workflow engine, shared Node runtimes, and foundational infrastructure drivers (LLMs, Vector Storage).
2. **Agents:** End-user facing agent workflows, paired cleanly into frontend and backend packages.
3. **Tools:** Standardized interfaces allowing our agents to communicate with third-party software (VCS, Project Management, Slack).

All internal packages belong to the NPM organization scope `@ai-crew-suite`.

## Local Plugin Files

### `tsconfig.json`

```json
{
  "extends": "../../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../../../dist-types/plugins/agents/alert-tuner/backend",
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../../frontend-core" } 
  ]
}
```

### `package.json`

```json
{
  "name": "@ai-crew-suite/agent-alert-tuner-backend",
  "scripts": {
    "start": "backstage-cli package start",
    "build": "backstage-cli package build", 
    "clean": "backstage-cli package clean",
    "typecheck": "tsc --build",
    "lint": "eslint . --max-warnings 0",
    "test:unit": "vitest run"
  },
  "devDependencies": {
    "@ai-crew-suite/config-eslint": "workspace:*",
    "@ai-crew-suite/config-vitest": "workspace:*",
    "@backstage/backend-test-utils": "backstage:^",
    "@backstage/cli": "backstage:^",
    "vitest": "^4.1.11"
  }
}
```

### `.eslintrc.cjs`

```javascript

```



### `vitest.config.ts`

```ts
import { mergeConfig } from 'vitest/config';
import baseConfig from '@ai-crew-suite/config-vitest';

export default mergeConfig(baseConfig, {
  test: {
    environment: 'node',
  },
});
```

### Run Unit Tests in a Plugin

```bash
yarn turbo run test:unit --filter=@ai-crew-suite/config-eslint
```

## ROUGH NOTES - DELETE

Instead of forcing every single plugin to manage its own `scripts` and copy-paste `devDependencies`, **hoist the binaries to the root and let Turborepo handle execution parameters directly.**

In a Yarn monorepo, dependencies installed at the root are available to root scripts. You can wipe out the local `scripts` block from your plugins entirely, change them to native `turbo` targets, and manage the tooling versions in exactly **one** place: the root `package.json`.

```json
{
  "$schema": "https://turbo.build",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "dist-types/**", "build/**"]
    },
    "clean": {
      "cache": false
    },
    "start": {
      "dependsOn": ["^build"],
      "command": "backstage-cli package start",
      "persistent": true,
      "cache": false
    }
    "typecheck": {
      "dependsOn": ["^build"],
      "command": "tsc --build",
      "outputs": []
    },
    "lint": {
      "dependsOn": ["^build"],
      "command": "eslint . --max-warnings 0",
      "outputs": []
    },
    "test:unit": {
      "dependsOn": ["build"],
      "command": "vitest run",
      "outputs": []
    }
  }
}
```

Notice the use of the `command` field. This tells Turborepo: "If a developer runs `turbo run lint`, go into the package directory and execute this raw binary syntax directly from the hoisted workspace layer."

You can strip out the highly uniform scripts (`lint`, `typecheck`, `clean`) to let Turbo orchestrate them globally, while leaving package-specific runtime scripts inside the package file.

If you adopt this alternative and completely strip the `scripts` blocks out of your 60+ leaf packages, running a targeted filter like:

```bash
yarn turbo run test:unit --filter=@ai-crew-suite/config-eslint
```

will work **perfectly**.

**leaf-level `package.json` requirements**

```json
{
  "name": "@ai-crew-suite/agent-alert-tuner-backend",
  "version": "0.0.1",
  "backstage": {
    "role": "backend-plugin",
    "pluginId": "ai"
  },
  "dependencies": {
    "@backstage/backend-plugin-api": "backstage:^",
    "yaml": "^2.9.0"
  }
}
```

**Yarn `catalog:` Protocol**

If you prefer or need to keep your scripts declared explicitly inside your plugins (for instance, if local IDE macros require running `yarn lint` natively inside a specific child folder), you should use Yarn’s built-in **`catalog:` protocol**.

This feature acts exactly like your `backstage.json` definition mapping, but works universally across your whole package tree for *any* dependency you specify.

**Declare your catalogs in the root `package.json`**

Define named catalogs containing the shared tooling version configurations at your repository root layer:

```json
{
  "name": "ai-crew-suite-root",
  "private": true,
  "workspaces": [
    "packages/*",
    "plugins/**/*"
  ],
  "dependenciesMeta": {
    "catalog:toolchain": {
      "@types/node": "^22.20.1",
      "eslint": "^10.10.0",
      "rimraf": "^6.1.3",
      "typescript": "^6.0.3",
      "vitest": "^3.2.7"
    },
    "catalog:typescript": {
      "typescript": "^6.0.3"
    },
    "catalog:eslint": {
      "eslint": "^10.10.0"
    },
    "catalog:vitest": {
      "vitest": "^3.2.7"
    },
    "catalog:node-types": {
      "@types/node": "^22.20.1"
    },
    "catalog:rimraf": {
      "rimraf": "^6.1.3"
    }
  }
}
```

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

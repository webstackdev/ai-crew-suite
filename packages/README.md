# 📦 Monorepo Workspaces Directory (`/packages`)

This directory serves as the centralized home for all internal applications, infrastructure tooling, and core platform distributions within the **AI Crew Suite** monorepo.

Every subdirectory within this folder is managed as an independent, isolated **Yarn Workspace**, linked together via our unified root-level dependency graph and orchestrated centrally by our custom CLI toolbelt.

## 📂 Active Core Workspaces

| Directory | Target Package Scope | Architectural Purpose & Responsibility |
| --- | --- | --- |
| **`app/`** | `@ai-crew-suite/app` | The master Spotify Backstage frontend UI application shell and plugin mount registry. |
| **`backend-modern/`** | `@ai-crew-suite/backend` | The production-ready Backstage backend framework utilizing the modern **New Backend System API** orchestration layers. |
| **`backend-legacy/`** | `@ai-crew-suite/backend-legacy` | The legacy Backstage backend server matrix, maintained during feature migration loops to support backward compatibility. |
| **`cli/`** | `@ai-crew-suite/cli` | The master developer toolbelt (`crew`), housing all centralized clean, build, lint, typecheck, and test configurations. |

## 🛠️ Unified Workspace Commands

Instead of maintaining brittle, disparate configuration scripts inside individual package folders, all workspaces follow a strict, standardized execution contract managed by the CLI toolbelt package.

Run any command using **`crew <command>`** from inside a specific workspace directory, or target them globally from the root using Turborepo:

- **`crew clean`** — Wipes local workspace build artifacts and internal caches.
- **`crew build`** — Compiles the target workspace using standard production compiler rulesets.
- **`crew lint`** — Executes strict static analysis against code boundaries using the shared Flat ESLint factory.
- **`crew typecheck`** — Forces static TypeScript compilation validations (`tsc --noEmit`).
- **`crew test:unit`** — Runs local unit tests instantly via Vitest, dynamically adjusting between JSDOM and Node based on the package role.

## 🏗️ Adding New Core Modules

When expanding the platform architecture with common code layers—such as shared theme plugins, utility libraries, or corporate React component packages—they should be placed right here inside the `/packages` scope.

📐 Structuring a New Shared Package

1. Create a dedicated folder matching your module name (e.g., `packages/theme`).

2. Implement a local `package.json` utilizing the `@ai-crew-suite` namespace scope and assign its standard `backstage.role` metadata property:

  ```json
  {
    "name": "@ai-crew-suite/theme",
    "version": "1.0.0",
    "private": true,
    "backstage": {
      "role": "web-library"
    },
    "scripts": {
      "build": "crew build",
      "clean": "crew clean",
      "lint": "crew lint",
      "typecheck": "crew typecheck",
      "test:unit": "crew test:unit"
    },
    "devDependencies": {
      "@ai-crew-suite/cli": "workspace:*"
    }
  }
  ```

3. Run **`crew sync:refs`** from the repository root to automatically align TypeScript Project References across the new workspace boundaries.

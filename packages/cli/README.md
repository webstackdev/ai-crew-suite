# 🧰 AI Crew Suite CLI & Developer Toolbelt (@ai-crew-suite/cli)

This package is the centralized developer toolbelt and workspace orchestrator for the AI Crew Suite monorepo. It consolidates all building, cleaning, linting, typechecking, and testing workflows into a single, high-performance binary utility.

By managing tooling constraints centrally within this package, we can upgrade, patch, or alter repo-wide build steps without touching or changing individual package script blocks across our 60+ workspaces.

## 🚀 Consuming this Toolbelt

Every package in the monorepo utilizes the uniform crew binary interface. To configure a child workspace, simply link the tool and expose its sub-commands within the package's local package.json:

```json
{
  "name": "@ai-crew-suite/my-frontend-plugin",
  "scripts": {
    "build": "crew build",
    "clean": "crew clean",
    "lint": "crew lint",
    "typecheck": "crew typecheck",
    "test:unit": "crew test:unit",
    "test:unit:coverage": "crew test:unit:coverage"
  },
  "devDependencies": {
    "@ai-crew-suite/cli": "workspace:*"
  }
}
```

## 🏛️ Core Features & Architecture

The CLI uses a smart tree-climbing utility (getWorkspaceContext()) that reads the executing folder's package.json and evaluates Spotify Backstage metadata parameters natively to understand its exact environment constraints.

```json
"backstage": {
  "role": "frontend-plugin"
}
```

### 🧠 Semantic Environment Routing

The tool maps the active workspace's roles into clear semantic runtime boundaries on the fly. This prevents developers from having to configure boilerplate environment scripts:

* **isBrowser Core Targets:** Mapped automatically for frontend, frontend-plugin, frontend-plugin-module, and web-library. Automatically sets Vitest to boot in a **JSDOM** sandbox and pulls down browser-specific lint rulesets.
* **isServer Core Targets:** Mapped automatically for backend, backend-plugin, backend-plugin-module, node-library, cli, and cli-module. Sets Vitest to a native, high-speed **Node** execution loop and enables server-side runtime validations.

## 🛠️ The Global Command Matrix

Run any command using crew `<command>` from within a package folder, or target it globally through Turborepo:

| Sub-command | Purpose | Cache Policy |
| --- | --- | --- |
| **crew clean** | Clears local caching matrices and dist/ folders. | Cache Bypass |
| **crew build** | Wraps backstage-cli package compilation rules. | Cacheable (dist/**) |
| **crew lint** | Performs zero-config ESLint Flat rules evaluations. | Cacheable |
| **crew typecheck** | Forces local tsc --noEmit compiler checks. | Cacheable |
| **crew sync:refs** | Synchronizes TypeScript Project References and heals roots. | Cache Bypass |
| **crew test:unit** | Fast, local, in-memory unit test matrix runner via Vitest. | Cacheable |
| **crew test:unit:coverage** | Comprehensive V8 block-coverage metric collection run. | Cacheable (coverage/**) |
| **crew test:e2e** | Enterprise Playwright integration test suite browser pipeline. | Cacheable |
| **crew storybook** | Launches a self-contained Vite development documentation hub. | Live Watch |
| **crew storybook:build** | Bundles static distribution UI document artifacts. | Cacheable |

## 💻 Local CLI Development Workflow

When actively refactoring or changing the CLI package itself, a dedicated development configuration bypasses the dist/ compilation loop to let you validate source files instantly from the raw src/ tree:

bash

### Execute unit and integration tests against local raw TypeScript source files

```bash
yarn turbo run test:unit --filter=@ai-crew-suite/cli
```

### Run local code-coverage metric scans against the CLI package

```bash
yarn turbo run test:unit:coverage --filter=@ai-crew-suite/cli
```

### Compile changes fresh using Rollup

```bash
yarn turbo run build --filter=@ai-crew-suite/cli
```

## 🧩 Shared Config Subpath Exports

This toolkit exposes zero-boilerplate configuration hooks directly to the monorepo ecosystem. For example, your master root-level configuration maps straight to the CLI's internal compiled code vectors using Yarn Workspaces link aliases:

```typescript
// eslint.config.js (At Monorepo Root)
import { createFlatConfigForWorkspace } from '@ai-crew-suite/cli/config/eslint';

export default createFlatConfigForWorkspace();
```

## 🛟 Self-Linting Special Exception

Because a node package cannot safely invoke its own uncompiled workspace binary hook while running clean cycles on its own files, the CLI uses a localized direct file pointer to trigger its code validation passes:

```json
"scripts": {
  "lint": "node ./dist/bin/crew.js lint"
}
```

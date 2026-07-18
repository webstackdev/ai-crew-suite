# AI Crew Suite

We transformed the original Roadie RAG plugins from a single-assistant, retrieval-only chat flow into a full agent platform while preserving retrieval quality as a core capability: we introduced an extensible agent runtime with registries for agents, tools, models, sources, and triggers; wrapped the existing retrieval pipeline as a first-class tool (`knowledge.retrieve`); added stateful orchestration support (including cyclic workflows), multi-agent role collaboration, human-in-the-loop approval/resume paths for write operations, structured run/step/tool streaming over SSE, and persistent runtime state (sessions, runs, steps, checkpoints, approvals, artifacts) backed by PostgreSQL alongside pgvector. We also delivered trigger-based execution (HTTP, events, cron/webhooks), integrated operational tool packs (for systems such as GitHub/Jira/Slack/PagerDuty/Kubernetes/Scaffolder/cost use cases), moved configuration to per-agent model/prompt/tool policies with sensible defaults, and hardened the platform for real use with observability, token/cost accounting, idempotency, and reliability controls. In parallel, we completed the package modernization and integration work required to run this cleanly in our Backstage monorepo (renamed/scope-aligned packages, frontend API provider wiring for notifications/search, module resolution and federation fixes, and strict Yarn PnP compatibility), resulting in a stable foundation where development, linting, testing, and type-checking all pass consistently.

## Getting Started

To get up and running with this repository, you will need to clone it off of GitHub and run an initial build.

```bash
git clone https://github.com/RoadieHQ/roadie-backstage-plugins.git
cd roadie-backstage-plugins
```

## Fetch dependencies and run an initial build from root directory

```bash
yarn install
yarn tsc
yarn build
```

You will be able to see plugins which are already integrated and installed in package.json inside

```bash
cd packages/app
```

folder.

Inside this repository you can add other plugins by running

```bash
// packages/app
yarn add <<plugin>>
```

followed by

```bash
// packages/app
yarn install
```

and running same command in root directory.

You should be able to run application from root directory, by running

```bash
yarn dev
```

## Structure of the repository

This repository is a place where all of the RoadieHQ plugins we are developed are integrated under `/plugins` folder. Depending on the type of the plugin they are separated in frontend or backend folder. Please note the scaffolder actions are handled separately. Plugins may be used and/or modified by following steps below:

### Plugins container

Navigate to

```bash
cd roadie-backstage-plugin/plugins
cd backend/frontend
cd selected-plugin
```

Plugin folders consist separate unit tests per every plugin, while general e2e tests are written under

```bash
cd roadie-backstage-plugin/packages/app/cypress/integration
```

folder.

### Sample service

In order to make E2E testing isolated from real entities, we have created `test-entity.yaml` under `packages/entitites`, which will be shown as sample-service entity when you start the app. This is used only for testing purposes and can be modified accordingly.

```bash
cd roadie-backstage-plugin/plugins
cd backend or cd frontend
cd selected-plugin
```

Plugin folders consist of separate unit tests for each plugin, while general E2E tests are written under

```bash
cd roadie-backstage-plugin/packages/app/cypress/integration
```

folder.

## License

Copyright 2026 Webstack Builders, Inc. Licensed under the [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)

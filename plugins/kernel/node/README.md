# @ai-crew-suite/plugin-kernel-node

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

This package defines the shared backend contracts and Backstage extension points used by the AI Crew Suite core plugins. It is the narrow interface layer between the core runtime, provider modules, retrieval modules, model modules, and future domain-specific agent modules.

### Core Responsibilities

- **Extension point definitions**: Exposes source, tool, model, agent, and trigger extension points for Backstage backend modules.
- **Runtime contracts**: Defines agent, orchestrator, retrieval, vector store, model, tool, run-store, session-store, artifact, approval, and audit-log interfaces.
- **Provider isolation**: Keeps provider modules dependent on stable abstract contracts instead of concrete runtime implementation details.

## Architectural Dependency Tree

This package acts as the interface layer within the broader AI Crew Suite ecosystem:

- **Upstream Interface**: Depends only on Backstage backend plugin APIs and LangChain base model/embedding abstractions.
- **Downstream Consumer**: Directly consumed by `plugin-ai-core-backend` and every `plugin-ai-core-backend-module-*` package.
- **Boundary Rule**: Do not import concrete backend runtime classes, provider SDK clients, or storage implementations into this package.

## Local Development Workflow

### 1. Installation & Builds

Run installation routines and build compilation tracks directly from the monorepo root:

```bash
yarn install --refresh
yarn turbo run build --filter=@ai-crew-suite/plugin-kernel-node
```

### 2. Running Unit & Integration Tests

```bash
yarn turbo run lint --filter=@ai-crew-suite/plugin-kernel-node
yarn turbo run test --filter=@ai-crew-suite/plugin-kernel-node
```

## Technical Extension Checklist

When modifying or extending code inside this workspace, ensure you update the corresponding global documentation indexes located at `/docs/core-development/` if you alter any of the following operational layers:

- [ ] Modifying core interface schemas or abstract contracts.
- [ ] Adding, renaming, or removing a Backstage extension point.
- [ ] Changing agent event, run persistence, retrieval, vector store, or model registration contracts.
- [ ] Introducing brand-new model adapter configurations.
- [ ] Altering backend ingestion worker pipelines.

## Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.

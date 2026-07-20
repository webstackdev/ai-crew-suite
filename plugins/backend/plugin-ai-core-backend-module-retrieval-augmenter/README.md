# @webstackbuilders/plugin-ai-core-backend-module-retrieval-augmenter

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

This package provides the default retrieval and indexing primitives used by AI Crew Suite. It converts Backstage catalog and TechDocs content into embedding documents, composes retrievers into query-time retrieval pipelines, and supplies the shared RAG behavior consumed by provider modules.

### Core Responsibilities

- **Indexing foundation**: Implements `DefaultVectorAugmentationIndexer` for catalog and TechDocs embedding creation and deletion.
- **Retrieval routing**: Provides source-based routing for vector retrieval and Backstage Search retrieval.
- **Post-processing**: Combines grouped retriever output into the final augmentation context supplied to agents.
- **Pipeline factory**: Exposes `createDefaultRetrievalPipeline` for provider modules that need a standard RAG pipeline.

---

## Architectural Dependency Tree

This package acts as a retrieval implementation module within the broader AI Crew Suite ecosystem:

- **Upstream Interface**: Dependent upon abstract definitions provided in `plugin-ai-core-node`.
- **Platform Services**: Uses Backstage Catalog, Discovery, Auth, and Search APIs to load and retrieve content.
- **Storage Dependency**: Operates against any implementation of the shared `VectorStore` contract.
- **Downstream Consumer**: Directly ingested by embeddings modules such as `plugin-ai-core-backend-module-aws` and `plugin-ai-core-backend-module-openai`.

---

## Local Development Workflow

### 1. Prerequisites & Context

This workspace relies on the monorepo's shared **Yarn Plug'n'Play (PnP)** caching layout. Ensure your local editor SDK configuration points directly to the active workspace TypeScript bundle.

### 2. Installation & Builds

Run installation routines and build compilation tracks directly from the monorepo root:

```bash
# Clean lockfile sync and refresh PnP maps
yarn install --refresh

# Compile TypeScript declarations into /dist targets
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-retrieval-augmenter build
```

### 3. Running Unit & Integration Tests

Test files are located inline next to the modules they validate (`*.test.ts`). Execute them via:

```bash
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-retrieval-augmenter test
```

---

## Technical Extension Checklist

When modifying or extending code inside this workspace, ensure you update the corresponding global documentation indexes located at `/docs/core-development/` if you alter any of the following operational layers:

- [ ] Modifying core interface schemas or abstract contracts.
- [ ] Adding a source, retriever, router, indexer, or post-processor contract.
- [ ] Introducing brand-new model adapter configurations.
- [ ] Altering backend ingestion worker pipelines.
- [ ] Changing chunking, source metadata, deletion, or retrieval merge semantics.

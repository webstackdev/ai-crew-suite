---
layout: default
title: Home
nav_order: 1
permalink: /
---

## AI Crew Suite Portal

Welcome to the internal engineering wiki for AI Crew Suite, a Backstage plugin workspace for retrieval-augmented, tool-using AI agents. These docs focus on how the platform is structured, how the core backend plugins fit together, and what maintainers should update when changing runtime contracts, provider modules, ingestion behavior, or vector storage.

AI Crew Suite started from the Roadie RAG AI plugin foundation and now layers an agent runtime on top of the retrieval pipeline. The result is a platform where `knowledge.retrieve` remains the standard RAG tool, while agents can also use registered models, tools, sources, triggers, memory, approvals, artifacts, and structured execution streams.

## Start Here

| Area                                                                      | Use it for                                                                                                                        |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [Core Development](core-development/)                                     | Architecture and maintainer docs for the backend runtime, extension points, orchestrators, providers, ingestion, and persistence. |
| [Runtime API & Operations](core-development/runtime-api.md)               | HTTP routes, server-sent events, run replay, triggers, approvals, hardening limits, and built-in tool-pack placeholders.          |
| [Ingestion Pipelines](core-development/ingestion-pipelines.md)            | How catalog and TechDocs content becomes retrievable embedding context.                                                           |
| [Embeddings & Vector Stores](core-development/embeddings-vectorstores.md) | Embedding providers, pgvector storage, runtime persistence, chunk sizing, dimensions, and re-indexing guidance.                   |

## Documentation Scope

The durable docs are the non-underscore pages under `docs/core-development`. They should be kept current whenever a core backend plugin changes behavior or public contracts.

The underscore-prefixed files in `docs/core-development` are temporary planning notes from the refactor. They may contain useful historical context, but they are not intended to be permanent navigation targets.

## Maintenance Rule

When changing code under `plugins/backend`, update the matching package README and the relevant page in this docs tree. In particular, update these docs when you change:

- core interfaces or extension points in `plugin-ai-core-node`
- runtime routes, SSE events, approvals, triggers, or hardening behavior in `plugin-ai-core-backend`
- indexing, chunking, retrieval routing, or post-processing behavior
- model provider configuration or model registration rules
- embedding dimensions, vector-store metadata, migrations, or pgvector query behavior

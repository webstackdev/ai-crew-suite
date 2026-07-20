---
layout: default
title: Embeddings & Vector Stores
parent: Core Development
---

## Embeddings & Vector Stores

{: .no_toc }

Embeddings modules turn source documents into vectors and register the retrieval/indexing dependency that the core backend needs at runtime. Vector store modules persist those vectors and execute similarity search. In AI Crew Suite, pgvector also persists agent runtime state, so this layer supports both RAG context and durable agent execution history.

### Storage Contracts

The shared `VectorStore` contract is intentionally small:

```typescript
interface VectorStore {
  connectEmbeddings(embeddings: Embeddings): void;
  addDocuments(docs: EmbeddingDoc[]): Promise<void>;
  deleteDocuments(params: {
    ids?: string[];
    filter?: EmbeddingDocMetadata;
  }): Promise<void>;
  similaritySearch(
    query: string,
    filter?: EmbeddingDocMetadata,
    amount?: number,
  ): Promise<EmbeddingDoc[]>;
}
```

Indexers connect the embedding model before writing documents. Retrievers use `similaritySearch` with optional metadata filters. The current default vector retriever filters by `{ source }` for source-specific queries and omits the filter for the special `all` source.

### pgvector Module

`@webstackbuilders/plugin-ai-core-backend-module-pgvector` provides two factories:

| Factory                     | Purpose                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `createPgVectorStore`       | Applies migrations, reads vector-store config, and returns a `VectorStore` implementation.                             |
| `createPgAgentRuntimeStore` | Applies migrations and returns a store implementing sessions, checkpoints, runs, artifacts, approvals, and audit logs. |

The module uses the Backstage database service and Knex. PostgreSQL must support the `vector` extension for embedding similarity search. The historical `uuid-ossp` requirement may still matter for existing deployments or migrations; verify the active migration before changing database extension assumptions.

Example vector storage config:

```yaml
ai:
  storage:
    pgVector:
      chunkSize: 500
      amount: 10
```

`chunkSize` controls batched inserts. `amount` controls the default number of similar documents returned when a caller does not provide an explicit retrieval amount.

### Runtime Persistence

`PgAgentRuntimeStore` is used by the core backend plugin during startup. It implements:

- `SessionStore` for conversation messages.
- `CheckpointStore` for resumable orchestration state.
- `RunStore` for run records, event logs, statuses, idempotency keys, and approvals.
- `ArtifactSink` for generated artifact references.
- `AuditLogSink` for approval and write-action audit records.

Message listing returns recent messages in chronological order after applying the limit. JSONB payloads are parsed defensively so callers receive structured payloads even when database drivers return serialized JSON strings.

### Embeddings Provider Modules

Embeddings providers register tools through `toolExtensionPoint`. Each tool exposes both an `augmentationIndexer` and a `retrievalPipeline`, which lets `plugin-ai-core-backend` create the generic `knowledge.retrieve` tool.

#### AWS Bedrock

`@webstackbuilders/plugin-ai-core-backend-module-aws` creates a pgvector store, constructs `BedrockAugmenter`, creates the default retrieval pipeline, and registers `aws.bedrock.retrieval`.

Provider config lives at `ai.embeddings.bedrock`:

```yaml
ai:
  embeddings:
    chunkSize: 1000
    chunkOverlap: 200
    concurrencyLimit: 10
    bedrock:
      modelName: amazon.titan-embed-text-v1
      region: us-east-1
      maxRetries: 3
      maxConcurrency: 100
```

`modelName` is required and must not be blank. Region falls back to `AWS_REGION`, then `AWS_DEFAULT_REGION`, then `us-east-1`. Cohere Bedrock models use the Cohere-specific embedding wrapper; model detection is case-insensitive.

#### OpenAI

`@webstackbuilders/plugin-ai-core-backend-module-openai` creates a pgvector store, constructs `OpenAiAugmenter`, creates the default retrieval pipeline, and registers `openai.embeddings.retrieval`.

Provider config lives at `ai.embeddings.openai`:

```yaml
ai:
  embeddings:
    chunkSize: 1000
    chunkOverlap: 200
    concurrencyLimit: 10
    openai:
      openAiApiKey: ${OPENAI_API_KEY}
      openAiBaseUrl: https://api.openai.com
      modelName: text-embedding-3-large
      batchSize: 512
      embeddingsDimensions: 3072
```

`batchSize` and `embeddingsDimensions` must be positive when supplied. If `openAiApiKey` is omitted, the OpenAI SDK follows its environment-variable behavior.

### Sizing Terms

Several config keys sound similar but tune different layers of the pipeline. Keep these meanings separate when reviewing changes or debugging retrieval quality.

| Key                                         | Layer           | What it measures                                                   | Change risk                                                              |
| ------------------------------------------- | --------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `ai.embeddings.chunkSize`                   | Ingestion       | Approximate text length per chunk before embedding.                | Safe to tune, but requires re-indexing to affect existing documents.     |
| `ai.embeddings.chunkOverlap`                | Ingestion       | Text carried across adjacent chunks to preserve boundary context.  | Safe to tune, but requires re-indexing to affect existing documents.     |
| `ai.embeddings.concurrencyLimit`            | Ingestion       | Number of concurrent source document processing tasks.             | Safe to tune for throughput and provider pressure.                       |
| `ai.embeddings.openai.batchSize`            | Provider API    | Number of chunks sent in one embedding request batch.              | Safe to tune within provider limits.                                     |
| `ai.embeddings.openai.embeddingsDimensions` | Embedding model | Numeric vector length produced per text chunk.                     | Destructive unless the vector table is rebuilt or isolated by dimension. |
| `ai.storage.pgVector.chunkSize`             | Database writes | Rows per bulk insert batch into PostgreSQL.                        | Safe to tune for database memory and write throughput.                   |
| `ai.storage.pgVector.amount`                | Retrieval       | Default number of nearest documents returned by similarity search. | Safe to tune, but it changes prompt size and retrieval diversity.        |

`chunkSize` is about source text. `embeddingsDimensions` is about vector shape. A 1,000-character text chunk can produce a 1,536-dimension vector, a 3,072-dimension vector, or another length depending on the embedding model. Those two values should not be compared or tuned as if they are the same unit.

`storage.pgVector.chunkSize` is also unrelated to text chunking. It is a database flush size: how many vector rows to insert per batch after the embedding provider has already returned vectors.

### Chunk Size Guidelines

Chunk size controls the tradeoff between retrieval precision, context completeness, and downstream prompt cost.

| Content type                                    | Suggested starting range | Why                                                                                                                                   |
| ----------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog entities, YAML, JSON, OpenAPI fragments | 250-500 characters       | Highly structured content often contains many unrelated fields; smaller chunks avoid mixing distinct endpoints or ownership metadata. |
| TechDocs how-to guides and README-style docs    | 800-1,200 characters     | Keeps a conceptual paragraph and nearby command or code block together without bloating the prompt.                                   |
| ADRs, RFCs, and long-form architecture notes    | 1,500-2,000 characters   | Preserves rationale and surrounding context that may be needed to answer design questions.                                            |

For the default catalog and TechDocs ingestion path, start with:

```yaml
ai:
  embeddings:
    chunkSize: 1000
    chunkOverlap: 200
```

That gives roughly a 20% overlap buffer. Increase `chunkSize` when retrieved snippets contain the answer but cut off the explanation or code example. Decrease it when retrieval pulls in long, only loosely related sections that crowd out more precise context.

### Chunk Overlap Guidelines

Overlap reduces boundary loss. Without overlap, a sentence, list item, or code example that straddles two chunks can lose meaning in both vectors. With `chunkSize: 1000` and `chunkOverlap: 200`, the splitter advances by about 800 characters per chunk:

```text
Chunk 1: characters 0-1000
Chunk 2: characters 800-1800
Chunk 3: characters 1600-2600
```

Use overlap when source documents are prose-heavy or contain explanatory code blocks. Keep it modest; very high overlap increases duplicate vectors, indexing cost, and the chance that near-identical chunks dominate the top retrieval results.

### Batch Size and Concurrency Guidelines

Provider `batchSize` and ingestion `concurrencyLimit` affect indexing throughput, not retrieval semantics.

`batchSize` groups multiple text chunks into one provider request. Larger batches reduce HTTP overhead but can hit provider payload limits, rate limits, or memory pressure. `concurrencyLimit` controls how many indexing tasks run at once, which is especially important when loading many TechDocs search indexes.

When tuning throughput:

1. Increase `batchSize` until provider latency improves or provider limits become visible.
2. Increase `concurrencyLimit` only when the provider and Backstage services can absorb the parallelism.
3. Watch indexing logs for partial TechDocs failures, provider throttling, and vector-count mismatches.
4. Keep database `storage.pgVector.chunkSize` separate; tune it based on PostgreSQL insert performance.

### Dimension Changes

Embedding dimensions are part of the storage contract even when they are not represented as a separate config field in the vector store. Changing embedding models, dimensions, or provider-specific dimension options can make old vectors incompatible with new query vectors.

When changing dimensions:

1. Confirm the new model's vector length.
2. Plan whether to truncate, migrate, or rebuild existing rows.
3. Clear or rebuild affected source embeddings.
4. Re-index every source that will be queried with the new model.
5. Run retrieval tests against representative catalog and TechDocs content.

Do not mix vectors from different dimensions in the same pgvector table unless the table schema and query code explicitly support that layout.

### Deletion Semantics

`DefaultVectorAugmentationIndexer.createEmbeddings` deletes existing documents for the requested supported source/filter before writing new documents. `deleteEmbeddings` resolves matching catalog entities and deletes the vector documents for their metadata.

`PgVectorStore.deleteDocuments` supports deleting by explicit IDs or by metadata filter. Avoid passing both unless the implementation has been intentionally updated and tested for that combination.

### Change Checklist

When changing embeddings or vector storage behavior:

- Add tests around vector count validation, deletion filters, similarity filters, and provider config validation.
- Re-index affected sources after changing chunking, metadata fields, embedding model, or dimensions.
- Keep `EmbeddingDoc.metadata.source` populated; retrieval routing depends on it.
- Validate provider errors at module startup where possible instead of during the first indexing run.
- Update [Ingestion Pipelines](ingestion-pipelines.md) if indexing source behavior changes.
- Update [LLM Providers](llm-providers.md) only when a module also registers executable generation models.

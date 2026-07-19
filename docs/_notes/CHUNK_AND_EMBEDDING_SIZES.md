Here is the exact technical breakdown of what these configuration keys mean, how they interact, and why they are separated.

## The Core Misunderstanding: Chunk Size vs. Dimensions

Your memory of specific numbers like **768, 1024, or 1536** refers to **`embeddingsDimensions`**, _not_ `chunkSize`.

- **`embeddingsDimensions` (Mathematical Vector Size)**: This is the number of numeric weightings (floating-point numbers) inside a single vector artifact. This is **hardcoded into the model's neural network structure**. For example, OpenAI's `text-embedding-3-small` defaults to `1536` dimensions, while `text-embedding-3-large` can go up to `3072`.
  - **Is it destructive to change?** **Yes, 100% accurate.** You _cannot_ compare a 768-dimension vector against a 1536-dimension vector. If you change models or alter this structural dimension key, you must drop your database table, re-split your text, and re-index everything from scratch.
- **`embeddings.chunkSize` (Text Character/Token Length)**: This is a free-form number representing how many characters (or tokens) of a text document (like a TechDoc file) are sliced into an individual block of text _before_ being sent to the embedding model. You can set this arbitrarily (e.g., 500, 1000, 1200) based on how much narrative context you want each database row to hold.

## Why are there separate "chunk" keys?

The two configurations represent completely different phases of your pipeline: data processing vs. database performance.

- **`embeddings.chunkSize` (Text Slicing Strategy)**: This happens at the **application level**. It dictates that if a TechDocs markdown file is 5,000 characters long, it will be chopped up into 5 distinct paragraphs of roughly 1,000 characters each. Each piece will get its own individual vector representation.
- **`storage.pgvector.chunksize` (Database Bulk Flush Size)**: This is a database optimization setting, which would be more accurately named `flushBatchSize`. When your indexing engine finishes converting hundreds of TechDocs into thousands of vectors, it doesn’t write them to PostgreSQL one by one (which is slow). Instead, it buffers them in memory and issues a bulk `INSERT` statement every time it hits **500 rows**. It has absolutely zero relationship to the length of the text or the model's dimensions.

## What is `chunkOverlap`?

When chopping a document into distinct pieces, you run into the "edge-truncation problem." If an important sentence happens to fall right at character 1,000, the first 5 words end up in Chunk 1 and the remaining 5 words end up in Chunk 2. The semantic meaning of that sentence is completely lost to the AI.

**`chunkOverlap: 200`** solves this by instructing the text splitter to rewind 200 characters before starting the next block.

- **Chunk 1**: Characters 0 to 1000.
- **Chunk 2**: Characters **800** to 1800.
- **Chunk 3**: Characters **1600** to 2600.

This ensures semantic continuity across boundaries so your RAG retrieval engine doesn't miss valuable concepts that span across text boundaries.

## What is `batchSize`?

When calculating embeddings via OpenAI or AWS Bedrock, making a separate HTTP network request for every single text chunk introduces heavy API latency.

**`batchSize: 512`** tells the application layer to group 512 text chunks together into a single, unified JSON payload array, sending them over a single HTTP POST request to the provider. This accelerates your background indexing loops and protects you against HTTP connection pooling failures.

## Summary Matrix

| Key                               | Layer     | Target Measurement                      | Can it be changed arbitrarily?             |
| --------------------------------- | --------- | --------------------------------------- | ------------------------------------------ |
| **`embeddings.chunkSize`**        | Ingestion | Text snippet length (characters/tokens) | **Yes** (Tuned for prompt context size)    |
| **`embeddings.chunkOverlap`**     | Ingestion | Duplicate character buffer size         | **Yes** (Prevents semantic splitting bugs) |
| **`embeddingsDimensions`**        | AI Model  | Mathematical vector columns             | **No** (Strictly dictated by the model)    |
| **`storage.pgvector.chunksize`**  | Postgres  | DB rows per bulk `INSERT` block         | **Yes** (Tuned for database memory limits) |
| **`embeddings.openai.batchSize`** | API       | Total chunks packed per HTTP request    | **Yes** (Tuned for network latency limits) |

## Sizing `embeddings.chunkSize`

When storing an entire **8,000-word document in a single embedding record**, you were likely using a long-context embedding model (such as `text-embedding-3-large` or `jina-embeddings-v3`) that allows up to 8,000 tokens or more per vector.

While technically possible, doing this for a Retrieval-Augmented Generation (**RAG**) plugin inside **Spotify Backstage** introduces two major operational issues: **semantic dilution** (the specific answer the developer needs gets buried in the average math of the giant vector) and **prompt window bloat** (sending three entire 8,000-word files into your LLM context window wastes thousands of developer platform API credits).

The optimal value for **`embeddings.chunkSize`** inside an Internal Developer Portal (IDP) depends on specific operational guidelines.

### Document Genre (The Backstage Target)

In an internal developer platform, your documentation typically breaks down into three distinct visual categories, each demanding a specific target chunk size:

- **API Catalogs & Reference Schemas (`chunkSize: 250 - 500 characters`)**: OpenAPI specs, JSON schemas, or Backstage `catalog-info.yaml` configurations are highly structured. Use small chunk sizes. If a chunk is too large, multiple distinct API endpoints get mashed into a single vector, causing inaccurate matches.
- **How-To Guides & TechDocs (`chunkSize: 800 - 1200 characters`)**: Standard markdown documentation files explaining internal platform setups (e.g., _"How to deploy to AWS EKS"_). This size ensures that an entire conceptual paragraph, along with its accompanying terminal code block (`bash...`), stays bound together in a single vector record.
- **Architecture Decision Records (ADRs) (`chunkSize: 1500 - 2000 characters`)**: Long-form design logs outlining deep engineering rationale. These require larger chunk sizes to ensure the background context and complete thought process are not broken apart.

### The Golden Ratio of Search Quality vs. LLM Cost

Your chunk size dictates how many distinct results you can feed into your downstream `LlmService` prompt template:

- **Small Chunks (e.g., 500)**: Allows you to retrieve the **Top 10** most relevant snippets from across 10 entirely different documentation files. This maximizes search diversity but can feel fragmented to the LLM if the text cuts off prematurely.
- **Large Chunks (e.g., 2000)**: Allows you to retrieve only the **Top 2 or 3** sections. This gives the LLM rich, unbroken narrative paragraphs, but risks missing an edge-case snippet buried in a different document.

### Practical Rule of Thumb for Your Project

Because the **Roadie RAG AI suite** is primarily optimized to ingest standard markdown **TechDocs** and repository **README** files, the industry-standard baseline configuration to start with is:

```yaml
embeddings:
  chunkSize: 1000 # Roughly 150-250 English words per chunk
  chunkOverlap: 200 # 20% overlap buffer to preserve semantic boundaries
```

### How to test your choice

1. Run your ingestion pipeline with `chunkSize: 1000`.
2. Ask your plugin a highly specific technical question (e.g., _"What is the fallback retry limit for our AWS gateway?"_).
3. Look at your terminal logs for `SearchRetriever` (which we refactored earlier). If the returned text snippet contains the answer but cuts off the code example right below it, increase your `chunkSize` to **1200**. If it returns the answer but clogs the prompt with a massive, unrelated troubleshooting guide, drop it to **800**.

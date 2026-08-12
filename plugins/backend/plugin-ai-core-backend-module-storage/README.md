Regarding this comment in `plugins/backend/plugin-ai-core-backend-module-storage-qdrant/README.md`:

> Agent runtime persistence (sessions, runs, checkpoints, approvals, artifacts, and audit logs) is intentionally out of scope and remains provided by `plugin-ai-core-backend-module-storage-pgvector`.

Kimi gave this analysis:

## Explaining the comment

The sentence is a scope statement, not a dependency declaration. The two storage modules split responsibilities like this:

`storage-pgvector` wears two hats (its `README` and exports confirm this):

1. A VectorStore for embeddings/similarity search (`PgVectorStore`)

2. The durable runtime store for the `AgentRuntime` — `PgAgentRuntimeStore`, which implements `SessionStore`, `CheckpointStore`, `RunStore`, `ArtifactSink`, `AuditLogSink` (see `PgAgentRuntimeStore.ts:55-56`), backed by packaged Knex migrations like `20260711000100_agent_runtime_state.js`

`storage-qdrant` wears only the first hat — it exports `createQdrantVectorStore` / `QdrantVectorStore` and nothing else. So even if a deployment swaps its embedding store from Postgres to Qdrant, there is no Qdrant-backed implementation of sessions, runs, checkpoints, approvals, artifacts, or audit logs. The comment is telling you: "that's deliberate, and the pgvector module remains the source of those runtime stores."

## Does the qdrant plugin depend on the pgvector plugin?

No — not as a package dependency. The qdrant module's package.json depends only on Backstage APIs, @qdrant/js-client-rest, @langchain/core, and @webstackbuilders/plugin-ai-core-node (the shared contracts). A repo-wide search shows the only mention of plugin-ai-core-backend-module-storage-pgvector inside the qdrant package is that one README sentence. There is no import, no workspace dependency, no code coupling.

But the backend plugin does. `plugin-ai-core-backend/package.json:62` has a hard `workspace:^` dependency on `@webstackbuilders/plugin-ai-core-backend-module-storage-pgvector`, because the `AgentRuntime` needs a runtime store and `createPgAgentRuntimeStore` (pgvector's service/index.ts:61) is currently the only implementation. The root `README`'s architecture diagram reflects this too: `Runtime --> Store[PostgreSQL runtime store]`.

## Practical consequence

If you deploy the AI Crew Suite with Qdrant as your vector store, you still:
Is it reasonable to think that end users deploying this in a cloud environment might want to use a different backend than postgresql for the durable runtime store for the `AgentRuntime`, like maybe Redis?
- get the pgvector package installed (via plugin-ai-core-backend), and
- need a reachable PostgreSQL database — not for embeddings, but for agent sessions, runs, checkpoints, approvals, artifacts, and audit logs.

So the relationship is better phrased as: the platform's runtime persistence currently depends on the pgvector module, independent of which vector store you choose. If you ever wanted a pure-Qdrant deployment with no Postgres, someone would need to write a QdrantAgentRuntimeStore (or a third storage module) implementing those five contracts — the `README` comment is essentially flagging that as intentionally not done yet.

## Should other backends be supported besides PostgreSQL?

Yes — that's a reasonable expectation, and the codebase shows the architecture was clearly built to *allow* it, even though the shipped wiring doesn't yet. Here's the full picture based on what's actually in the repo:

## Why the demand is plausible

**1. The contracts were designed for exactly this swap.** The five runtime-store interfaces live in the shared contracts package (`plugin-ai-core-node`), not in the pg module, and they're tiny and storage-agnostic:

- `SessionStore` — create/append/list messages (`session.ts:41`)
- `CheckpointStore` — `save(runId, state)` / `load(runId)` — pure key-value (`run.ts:51`)
- `RunStore` — run records, idempotency-key lookup, append-only event log with `seq` ordering, approvals (`run.ts:169`)
- `ArtifactSink` / `AuditLogSink` — one write-only method each (`run.ts:107,135`)

**2. The vector store already set the precedent.** Users can swap pgvector → Qdrant for embeddings today. A cloud deployment that picks a managed vector DB may have *no other reason to run Postgres*, and managed Redis (ElastiCache, Memorystore, Azure Cache) is often already provisioned. So "why must I still run Postgres for sessions?" is a question adopters will inevitably ask — the qdrant README comment your analysis quotes is essentially an admission of that gap.

**3. The access patterns map naturally onto Redis.** Checkpoints are GET/SET by runId; session messages are a bounded list per key (TTL-able); run steps are an ordered append log (Redis lists or streams); idempotency dedup is `SET NX`; run/approval lookups are hashes. Nothing in the contracts requires SQL.

## The important caveat: "durable" is doing work in that sentence

The five contracts have **heterogeneous durability profiles**, and Redis fits them unevenly:

| Contract | Redis fit |
| :--- | :--- |
| `CheckpointStore` | Excellent — opaque blob, classic cache semantics |
| `SessionStore` | Good — conversation window, naturally ephemeral |
| `RunStore` (runs, steps) | Reasonable — but event replay and `findRunByIdempotencyKey` need careful key/index design |
| `RunStore` (approvals) | Weaker — human-authorization records want strong durability |
| `AuditLogSink` | Weakest — compliance-adjacent, append-forever records; Redis with AOF-everysec can still lose ~1s of writes, and it's operationally treated as ephemeral |

Notably, nothing forces one backend to implement all five: `createAiBackendServices` (`factory.ts:362`) accepts `sessionStore`, `checkpointStore`, `runStore`, `artifactSink`, `auditLogSink` as **separate options**. A hybrid — Redis for sessions/checkpoints, Postgres for runs/audit — is already possible at the library level.

## Two things the current analysis understated

**The Postgres coupling is packaging, not capability.** The runtime migration (`20260711000100_agent_runtime_state.js`) creates plain relational tables — UUIDs, FKs, `jsonb`, indexes. No vector columns, nothing pgvector-specific. The runtime store is tied to the pgvector module only because the migrations ship there and one instance fills all five roles. So arguably the *most* likely alternative-backend ask isn't Redis at all — it's "just use my existing Backstage database" (MySQL) or a cloud-native store (DynamoDB/Cosmos DB, which would mirror the suite's existing AWS/Azure/GCP module structure).

**There's no extension point for stores yet.** `plugin.ts:108-124` hardcodes `createPgAgentRuntimeStore` — agents, tools, and triggers all get extension points, but runtime stores don't. So today an adopter can't inject a `RedisAgentRuntimeStore` into `ragAiPlugin` as shipped; they'd have to compose their own backend plugin around the exported `createAiBackendServices` seam, or the platform would need to add a `runtimeStoreExtensionPoint` / config-driven selection first.

## Verdict

Reasonable as a product direction, and clearly anticipated by the interface design. Redis specifically is a strong fit for the low-durability slices (sessions, checkpoints, run liveness) but a risky system of record for audit logs and approvals. If the real goal is "a Qdrant deployment with no Postgres," a document/table store (DynamoDB-style) or a dialect-agnostic SQL store over the existing Knex client would cover all five contracts more uniformly. The cheapest enabling step either way is the same: add a runtime-store extension point and stop hardcoding the pg store in `plugin.ts` — the composition seam underneath already supports it.

## Gemini's Opinion

To cover typical deployments by Backstage end-users, you should primarily support **PostgreSQL** and **SQLite**, as these are the only two officially supported and tested database backends in the Backstage ecosystem.

Because Backstage natively leverages **Knex.js** for database queries and migrations, utilizing the core Backstage `DatabaseService` allows your session storage to remain entirely database-agnostic out of the box.

The target engines to consider for your plugins are broken down below:

### Primary Backends (Must Support)

- **PostgreSQL**: This is the **de facto production database** for virtually all real-world Backstage deployments. Companies running Backstage at scale deploy it on Kubernetes linked to managed services like Azure Database for PostgreSQL or AWS RDS.
- **SQLite (`better-sqlite3`)**: This is the default engine used for **local development, testing, and prototyping**. If your plugin does not cleanly support SQLite, developers will struggle to run or evaluate your plugin locally.

### Caching & Session Stores (Optional / Advanced)

- **Redis / Memcached**: Backstage features a built-in `CacheService` that operators frequently back with Redis or Memcached. If you want to offer an alternative, high-performance, ephemeral session storage option alongside the standard relational database storage, providing a Redis adapter is highly valuable for horizontally scaled production setups.

Both questions now have definitive answers from the code.

## 1. `artifactSink` — it is implemented and it is used

I left it out of the Redis-fit table for brevity, not because it's dead code — and I should have included it, because it's fully wired:

**Contract:** `plugin-ai-core-node/src/@types/run.ts:107-110` — one method, `record(artifact)`.

**Implementation:** `PgAgentRuntimeStore.record()` at `PgAgentRuntimeStore.ts:306-314` — inserts into `ai_artifacts` (created by migration `20260711000100:76-83`).

**Consumers:** `AgentRuntime.recordArtifact()` (`AgentRuntime.ts:453-466`) calls `ctx.artifactSink?.record(...)`, and it's invoked from **both** event-processing paths:

- the initial run loop — `AgentRuntime.ts:383-385` fires it on every `artifact` event;
- the resume path — `AgentRuntime.ts:492-493` (`processResumeEvent`), which also writes an `artifact_recorded` audit entry.

So it's live whenever the sink is wired in (`plugin.ts:122`), though optional-chained like all five stores.

**Why its omission matters to your Redis question:** the artifact record is tiny — `id`, `runId`, `kind`, `ref`, `url`. The artifact *content* lives elsewhere; this table is only a pointer. So technically any backend (Redis included) can hold it. The real design question is **grouping**: artifact records are the "what did this run produce" ledger, so they belong with the system-of-record data (runs, approvals, audit) rather than the cache-tier data (sessions, checkpoints). If you split stores by durability, `ArtifactSink` goes on the durable side — that's the row it deserved in my table.

## 2. The session store is database-agnostic *code* with Postgres-specific *packaging*

**The code runs on whatever database the adopter configured.** Tracing the wiring:

- `plugin.ts:103,108-111` — the plugin depends on `coreServices.database` (Backstage's core Database Service) and passes it straight to `createPgAgentRuntimeStore`.
- `service/index.ts:64-68` — `database.getClient()` returns the Knex client for **whatever `backend.database.client` the Backstage deployment uses** (pg, mysql, sqlite), then `new PgAgentRuntimeStore(dbClient)`.
- Every method in `PgAgentRuntimeStore` — including the session methods at lines 68-114 — uses only dialect-neutral Knex query-builder calls. No raw SQL, no pg-specific functions. Even the upsert (`PgAgentRuntimeStore.ts:125-129`, `.onConflict('run_id').merge(...)`) compiles to `ON CONFLICT … DO UPDATE` on pg, `ON DUPLICATE KEY UPDATE` on MySQL, and works on SQLite.

**But the migration path forces PostgreSQL in practice.** `applyDatabaseMigrations` (`database/migrations.ts:24-33`) runs `knex.migrate.latest` over the module's *entire* migrations directory, which mixes two concerns:

| Migration                                                    | Dialect portability                                          |
| :----------------------------------------------------------- | :----------------------------------------------------------- |
| `20231216153432_init_vector_embeddings_store.js`             | **Hard pg-only**: `create extension "vector"`, `create extension "uuid-ossp"`, raw `ALTER TABLE … ADD vector vector` |
| `20260711000100_agent_runtime_state.js` (sessions, runs, checkpoints, approvals, artifacts) | Schema-builder calls are portable (`jsonb` maps to `json` on MySQL/SQLite), **except** one raw statement at line 22-24: `metadata->>'source'` — Postgres JSON-operator syntax (fails on MySQL; SQLite 3.38+ tolerates it). Note it backfills the *embeddings* table, not the runtime tables |
| `20260711000200_ai_audit_logs.js`                            | Fully portable                                               |

Since the vector migration runs first chronologically, a MySQL deployment dies there before the runtime tables are ever created. The doc comment at `service/index.ts:55-60` ("the runtime store shares the same migration path as the vector store") acknowledges this deliberately.

**Practical implications:**

- The runtime store tables also land in the **ai-core plugin's own database division** (Backstage gives each plugin its own schema on pg / prefixed tables on MySQL), since the client comes from the plugin's injected `coreServices.database` — not a separate connection.
- This sharpens the earlier conclusion: making the existing runtime store work on non-pg databases is a **migration-packaging problem, not a store-code problem**. Splitting the runtime migrations from the vector migration (or gating the vector one on dialect) would make `PgAgentRuntimeStore` runnable on MySQL/SQLite with essentially zero changes to the store itself. A future `RedisAgentRuntimeStore` is a separate, larger effort — it would reimplement the five contracts against Redis data structures with no migrations at all.

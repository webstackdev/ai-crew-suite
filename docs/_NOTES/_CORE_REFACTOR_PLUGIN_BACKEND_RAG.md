# RAG Group Refactor — LLM, Storage, Retrieval

Implementation plan for the retrieval/RAG group: the model capability modules (LLM providers), vector storage providers, and the retrieval-augmenter composition.

**Naming normalization (global)**: `storage-vector` is renamed to `vector-storage` across the repo. The core module becomes `plugin-ai-core-backend-module-vector-storage`; providers become `plugin-ai-core-backend-module-vector-storage-pgvector` and `plugin-ai-core-backend-module-vector-storage-qdrant`. The extension point ID is `plugin-ai.vector.storage` (kept as `vectorStoreExtensionPoint` in code).

**Group members** (7 existing packages + 1 new core module):

- `plugin-ai-core-backend-module-llm-aws`
- `plugin-ai-core-backend-module-llm-openai`
- `plugin-ai-core-backend-module-llm-openrouter`
- `plugin-ai-core-backend-module-vector-storage-pgvector` (renamed from `storage-pgvector`)
- `plugin-ai-core-backend-module-vector-storage-qdrant` (renamed from `storage-qdrant`)
- `plugin-ai-core-backend-module-retrieval-augmenter`
- NEW: `plugin-ai-core-backend-module-vector-storage` (core extension module — greenfield)

**Self-contained**: assume `plugin-ai-core-node` is refactored (provides `chatModelsExtensionPoint`, `embeddingsExtensionPoint`, `vectorStoreExtensionPoint`, `ChatModelDefinition`, `EmbeddingsDefinition`, `VectorStoreDefinition`, and `EmbeddingsSource`/`VectorStore` contracts). This document fully specifies the RAG-group refactor independent of the core-backend engine.

**Ground rules**:

No backwards compatibility with existing code, this is a greenfield refactor. The current inversion is broken; in the existing design, LLM modules import and instantiate `createPgVectorStore` / `createQdrantVectorStore` directly; the `retrieval-augmenter` composes whatever store an LLM module happened to pick. Providers become pure registrations; retrieval-augmenter composes embedder + store from extension points.

**Provider capability rule**: all LLM provider modules register into **all** model capability categories they can satisfy based on user-provided config. A provider may register a subset (e.g. Cohere registers only reranking) — registrations are optional per capability. The design anticipates providers adding or discontinueing capabilities over time.

- `llm-aws` registers chat (Claude) + embeddings (Titan) + transcription (Amazon Transcribe / Nova multimodal) + reranking (Cohere Rerank via Bedrock) + guardrail (Bedrock Guardrails)
- `llm-openai` registers chat (GPT) + embeddings (text-embedding-3) + transcription (Whisper) + reranking (via prompt-simulated Reranker) + guardrail (OpenAI Moderation)
- `llm-openrouter` registers chat + embeddings + transcription (aggregates many providers).

Capability registrations are config-gated; a missing config key simply skips that registration.

## Current architecture (the problem)

```
llm-aws module.ts          llm-openai module.ts
  import createPgVectorStore ──┐
  const vectorStore = ...      │
  new BedrockAugmenter({ vectorStore, embeddings }) ──┤
  createDefaultRetrievalPipeline({ vectorStore })     │
                             │                        │
                             ▼                        ▼
        PgVectorStore (storage-pgvector)   Bedrock/Titan embeddings (llm)
        QdrantVectorStore (storage-qdrant) OpenAI embeddings (llm)
```

Issues:
1. **Hard-coded store of choice**: each LLM module decides which vector store to instantiate (both pick pgvector; qdrant is unreachable through config).
2. **Self-contained bundling**: `new BedrockAugmenter(...)` / `new OpenAiAugmenter(...)` builds embedding generation + storage + retrieval in one module.
3. **Storage providers are incomplete**: they export a factory function (`createPgVectorStore`/`createQdrantVectorStore`) but have no registry/extension point — no way to resolve an active store from config.
4. **Retrieval-augmenter can't compose**: it receives whatever store the LLM module picked; it cannot select embedder + store independently.

## Target architecture

```
llm-aws module.ts          llm-openai module.ts
  embeddingsExtensionPoint.addEmbeddings(BedrockTitan)
  embeddingsExtensionPoint.addEmbeddings(OpenAi)
                             │
                embeddingsExtensionPoint ──┐
                             │            │
vector-storage-pgvector      │   vector-storage (core module) holds
  vectorStoreExtensionPoint.addVectorStore({id:'pgvector', store})  ◄── the Map
                             │            │
vector-storage-qdrant        │            │
  vectorStoreExtensionPoint.addVectorStore({id:'qdrant', store})    │
                             │            │
        retrieval-augmenter  │            │
          resolves embedder + active store from extension points    ▼
          by config (ai.embeddings.provider: string, ai.embeddings.store: string)
```

Each provider is a pure registration. Retrieval-augmenter composes. No LLM module imports a storage factory.

---

## Package 0 — Core-node and core-backend touchpoints (RAG-driven)

These are the code changes in the two already-refactored plugins required by this group. They are part of this plan, not a separate effort.

### `plugin-ai-core-node`

- Rename the extension point ID from `plugin-ai.storage.vector` to `plugin-ai.vector.storage` (the exported symbol stays `vectorStoreExtensionPoint` — it reads better; only the string ID changes).
- No other changes; `VectorStoreDefinition` and all model category contracts are already correct.

### `plugin-ai-core-backend`

- No functional changes required. The engine consumes models through the category extension points and is provider-agnostic. If any doc or comment references the old `storage-vector` package name, update it as part of this group's docs pass.

---

## Package 1 — NEW core module: `plugin-ai-core-backend-module-models-chat`

The chat capability category registry core module. Owns the `Map` of chat models, the extension point, config-driven resolution of the active chat model, and the tool factory for `chatModelsExtensionPoint`.

### Structure (new package)

```
plugin-ai-core-backend-module-models-chat/
  package.json  tsconfig.json  config.d.ts  README.md
  src/
    index.ts
    module.ts
    registry.ts          # internal Map<string, ChatModelDefinition> + resolve()
    config.ts            # reads ai.embeddings.provider + ai.embeddings.model
    __tests__/module.test.ts  registry.test.ts
```

`src/registry.ts`:

```ts
import { ChatModelDefinition } from '@webstackbuilders/plugin-ai-core-node';

export class ChatModelRegistry {
  private readonly models = new Map<string, ChatModelDefinition>();
  register(def: ChatModelDefinition): void {
    if (this.models.has(def.id)) throw new Error(`ChatModel '${def.id}' registered twice`);
    this.models.set(def.id, def);
  }
  resolve(configuredId: string): ChatModelDefinition {
    const def = this.models.get(configuredId);
    if (!def) {
      throw new Error(`No chat model registered for '${configuredId}'. Import the matching provider plugin.`);
    }
    return def;
  }
  list(): ChatModelDefinition[] {
    return [...this.models.values()];
  }
}
```

`src/config.ts`: reads `ai.models.chat.provider: string` (e.g. `'openai'` or `'aws'`).

`src/module.ts`: exposes the extension point; on init, resolves the configured chat model and re-exports it as the active chat model.

This is the single place where "which chat model is active" is decided.

## Package 2 — NEW core module: `plugin-ai-core-backend-module-models-embeddings`

The embeddings capability category registry core module. Owns the `Map` of embeddings models, the extension point, config-driven resolution, and exposes the active embedder.

```
plugin-ai-core-backend-module-models-embeddings/
  package.json  tsconfig.json  config.d.ts  README.md
  src/
    index.ts  setupTests.ts
    module.ts     # registers via embeddingsExtensionPoint
    @types/index.ts
    service/index.ts  # keep factory functions internally
    __tests__/module.test.ts
```

`src/config.ts`: reads `ai.embeddings.provider: string` (e.g. `'openai'` or `'aws'`).

`src/module.ts`: exposes the extension point; on init, resolves the configured embedder and re-exports it.

## Package 3 — NEW core module: `plugin-ai-core-backend-module-models-transcription`

The transcription capability category registry core module. Owns the `Map` of transcription providers, the extension point, config-driven resolution, and exposes the active transcription client.

```
plugin-ai-core-backend-module-models-transcription/
  package.json  tsconfig.json  config.d.ts  README.md
  src/
    index.ts  setupTests.ts
    module.ts     # registers via transcriptionExtensionPoint
    __tests__/module.test.ts
```

`src/config.ts`: reads `ai.transcription.provider: string`.

`src/module.ts`: exposes the extension point; on init, resolves the configured transcription provider.

## Package 4 — NEW core module: `plugin-ai-core-backend-module-models-reranking`

The reranking capability category registry core module. Owns the `Map` of reranking providers, the extension point, config-driven resolution, and exposes the active reranking client.

```
plugin-ai-core-backend-module-models-reranking/
  package.json  tsconfig.json  config.d.ts  README.md
  src/
    index.ts  setupTests.ts
    module.ts     # registers via rerankingExtensionPoint
    __tests__/module.test.ts
```

`src/config.ts`: reads `ai.reranking.provider: string`.

`src/module.ts`: exposes the extension point; on init, resolves the configured reranking provider.

## Package 5 — NEW core module: `plugin-ai-core-backend-module-models-guardrail`

The guardrail capability category registry core module. Owns the `Map` of guardrail providers, the extension point, config-driven resolution, and exposes the active safety classifier.

```
plugin-ai-core-backend-module-models-guardrail/
  package.json  tsconfig.json  config.d.ts  README.md
  src/
    index.ts  setupTests.ts
    module.ts     # registers via guardrailModelsExtensionPoint
    __tests__/module.test.ts
```

`src/config.ts`: reads `ai.guardrail.provider: string`.

`src/module.ts`: exposes the extension point; on init, resolves the configured safety classifier.

Adds a boot-time warning if guardrails are enabled but no provider is registered (protects OpenRouter-only installations).

## Model Tiers

We want provider modules (like `plugin-ai-core-backend-module-llm-openai`) to offer config allowing our agentic workflow plugins (`plugin-ai-agent-backend-*`) to specify a model tier, and the provider to dynamically select the model or config for a model based on that. For example, `fast` or `reasoning`. This plan can be modified if you see a better or more useful approach.

The purpose of config indirection is to let a workflow agent plugin name `fast`/`reasoning` instead of a concrete `modelRef`, so operators can retune spend in one place.

Three small pieces:

**Config** (`config.d.ts`):

```yaml
ai:
  models:
    tiers:
      fast: gpt-4o-mini          # tier name -> modelRef
      reasoning: claude-sonnet-4
      embeddings: text-embedding-3-large
```

```ts
ai?: {
  models?: {
    tiers?: Record<string, string>;  // tier name -> model registry ID
  };
};
```

**Agent definition** — `modelRef` gains a tier alternative:

```ts
export type AgentDefinition = {
  // ...
  /** Either a concrete model registry ID or a tier name resolved via config. */
  modelRef: string;   // 'gpt-4o' (direct) or 'fast' / 'reasoning' (tier)
};
```

**Resolution** in `ModelExecutor` (one indirection, resolved at boot with fail-loud validation):

```ts
resolveModel(agent: AgentDefinition): BaseChatModel {
  const ref = tiers.get(agent.modelRef) ?? agent.modelRef;  // tier → ref, else treat as ref
  const model = modelRegistry.get(ref);
  if (!model) throw new Error(`Agent '${agent.id}' references unknown model/tier '${agent.modelRef}'`);
  return model;
}
```

Properties that make this worth the indirection:

- **Operators retune spend without touching plugin code or agent definitions.** Downgrading `reasoning: claude-opus` → `claude-sonnet` is a config change; every agent on the `reasoning` tier moves at once. This pairs directly with your usage/cost-monitoring goal — the tier becomes a first-class grouping dimension in spend reports ("what are we spending on `reasoning` vs `fast`?").
- **Per-agent overrides survive.** An agent can always name a concrete `modelRef`; tiers are optional sugar, validated identically at boot (unknown tier → same boot error as unknown model — no new failure mode).
- **Crew-style heterogeneity returns cleanly.** The deleted crew feature wanted "cheap model for research, strong model for review." Tiers express that as *nodes within one workflow* — a node's prompt builder can request `ctx.model.forTier('fast')` vs `forTier('reasoning')`, which is a better home for the idea than the crew orchestrator was. That means `NodeExecutionContext.model` exposes both `default` (the agent's resolved model) and `forTier(name)`.
- **Deterministic tests unaffected.** Test harnesses register fixture models under tier names directly.

Cost: one config block, one resolution function, one `forTier` method, boot validation. It deliberately does **not** add dynamic tier selection (model-chooses-tier, latency-based fallback) — static config indirection only. Dynamic selection will not be implemented for this project.

## Package 6 — NEW core module: `plugin-ai-core-backend-module-vector-storage` (renamed from `storage-vector`)

The vector-store registry core module (the "core extension" for storage, analogous to `module-vcs` for VCS or `module-observability` for observability). Owns the `Map`, the extension point, config-driven resolution, and exposes the active store.

### Structure (new package)

```bash
plugin-ai-core-backend-module-vector-storage/
  package.json
  tsconfig.json
  config.d.ts
  README.md
  src/
    index.ts
    module.ts
    registry.ts          # internal Map<string, VectorStoreDefinition> + resolve()
    config.ts            # reads ai.embeddings.store
    __tests__/module.test.ts
              registry.test.ts
```

`src/registry.ts`:

```ts
import { VectorStoreDefinition, VectorStore } from '@webstackbuilders/plugin-ai-core-node';

export class VectorStoreRegistry {
  private readonly stores = new Map<string, VectorStoreDefinition>();
  register(def: VectorStoreDefinition): void {
    if (this.stores.has(def.id)) throw new Error(`VectorStore '${def.id}' registered twice`);
    this.stores.set(def.id, def);
  }
  resolve(configuredId: string): VectorStore {
    const def = this.stores.get(configuredId);
    if (!def) {
      throw new Error(
        `No vector store registered for '${configuredId}'. ` +
        `Import the matching @webstackbuilders/plugin-ai-core-backend-module-vector-storage-<provider> package.`,
      );
    }
    return def.store as VectorStore;
  }
  list(): VectorStoreDefinition[] {
    return [...this.stores.values()];
  }
}
```

`src/config.ts`: reads `ai.embeddings.store: string` (e.g. `'pgvector'` or `'qdrant'`) — defaults to `'pgvector'` for convenience but allows any registered ID.

`src/module.ts`: exposes the extension point; on init, resolves the configured store and re-exports it as the active `VectorStore` for retrieval-augmenter to consume.

This is the single place where "which vector store is active" is decided.


### Vector Storage Tools

The `vectorStoreExtensionPoint` registration automatically exposes `vectorStore.*` tools (similarity search, filtered search, get_by_id, upsert, delete, clear, collection.list, collection.create) to the active agent workflow. Tools are declared with `effect: 'read'` or `effect: 'write'` per op:

| Tool ID | Effect | Purpose |
| --- | --- | --- |
| `vector_store.collection.similarity_search` | read | Standard semantic search |
| `vector_store.collection.filtered_search` | read | Entity-scoped semantic search (filtered by catalog entity) |
| `vector_store.document.get_by_id` | read | Fetch a chunk by ID |
| `vector_store.document.upsert` | write | Add/update content chunks (triggers embedding before write) |
| `vector_store.document.delete` | write | Delete a chunk by ID |
| `vector_store.collection.clear` | write | Wipe an entire collection |
| `vector_store.collection.list` | read | List available collections |
| `vector_store.collection.create` | write | Provision a new collection (pgvector table / Qdrant collection) |

This allows the vector store module to serve both as a registry and as a tool provider for the active workflow's retrieval needs.
## Package 7 — `plugin-ai-core-backend-module-vector-storage-pgvector` → provider

Rename from `plugin-ai-core-backend-module-storage-pgvector`. Convert from factory-export to pure provider registration.

### Target `src` (after) — adds module.ts

```bash
plugin-ai-core-backend-module-vector-storage-pgvector/
  package.json
  tsconfig.json
  config.d.ts
  README.md
  src/
    index.ts
    setupTests.ts
    module.ts                 # NEW: registers via vectorStoreExtensionPoint
    @types/index.ts
    service/index.ts          # keep createPgVectorStore factory (used internally)
    service/PgVectorStore.ts
    service/__tests__/index.test.ts
    service/__tests__/PgVectorStore.test.ts
    database/migrations.ts  
    database/__tests__/migrations.test.ts
```

`src/module.ts`:

```ts
import { createBackendModule, coreServices } from '@backstage/backend-plugin-api';
import { vectorStoreExtensionPoint } from '@webstackbuilders/plugin-ai-core-node';
import { createPgVectorStore } from './service';

export const aiCoreBackendModuleVectorStoragePgVector = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'vector-storage-pgvector',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        stores: vectorStoreExtensionPoint,
      },
      async init({ config, logger, database, stores }) {
        const store = await createPgVectorStore({ logger, database, config });
        stores.addVectorStore({ id: 'pgvector', store });
        logger.info('Registered pgvector vector store provider.');
      },
    });
  },
});
export default aiCoreBackendModuleVectorStoragePgVector;
```

- Keep `service/index.ts` `createPgVectorStore` export (used by the module internally; the factory function itself is unchanged).
- `database/migrations.ts` unchanged (still runs via `coreServices.database`).
- `module.test.ts` asserts registration with a mocked `vectorStoreExtensionPoint`.


## Package 8 — `plugin-ai-core-backend-module-vector-storage-qdrant` → provider

Rename from `plugin-ai-core-backend-module-storage-qdrant`. Same conversion as pgvector, mirroring structure.

```bash
plugin-ai-core-backend-module-vector-storage-qdrant/
  package.json
  tsconfig.json
  config.d.ts
  README.md
  src/
    index.ts
    setupTests.ts
    module.ts               # NEW: registers via vectorStoreExtensionPoint (id: 'qdrant')
    @types/index.ts
    service/index.ts        # keep createQdrantVectorStore factory internally
    service/QdrantVectorStore.ts
    service/__tests__/index.test.ts
    service/__tests__/QdrantVectorStore.test.ts
```

`src/module.ts` mirrors the pgvector module but registers `{ id: 'qdrant', store }`.

## Package 9 — `plugin-ai-core-backend-module-llm-aws` → all capabilities it supports

Convert from self-contained to pure provider registrations across all capability categories. AWS supports chat (Claude), embeddings (Titan), and guardrail (Bedrock Guardrails) — all are registered; each is optional per config key presence.

### Target `src` (after)

```bash
plugin-ai-core-backend-module-llm-aws/
  package.json
  tsconfig.json
  config.d.ts
  README.md
  src/
    index.ts
    setupTests.ts
    module.ts
    chat/
      index.ts
      BedrockChat.ts        # Claude-on-Bedrock chat client (new)
      __tests__/BedrockChat.test.ts
    embeddings/
      index.ts
      BedrockEmbeddings.ts  # moved from BedrockAugmenter.ts (Titan; Cohere input_type batching preserved)
      __tests__/BedrockEmbeddings.test.ts
    transcription/
      index.ts
      BedrockTranscription.ts # Amazon Transcribe / Nova multimodal (new)
      __tests__/BedrockTranscription.test.ts
    reranking/
      index.ts
      BedrockRerank.ts      # Cohere Rerank via Bedrock (new)
      __tests__/BedrockRerank.test.ts
    guardrail/
      index.ts
      BedrockGuardrail.ts   # Bedrock Guardrails client (new)
      __tests__/BedrockGuardrail.test.ts
```

`src/module.ts` registers into every category AWS supports, each registration config-gated:

```ts
import { createBackendModule, coreServices } from '@backstage/backend-plugin-api';
import {
  chatModelsExtensionPoint,
  embeddingsExtensionPoint,
  transcriptionExtensionPoint,
  rerankingExtensionPoint,
  guardrailExtensionPoint,
} from '@webstackbuilders/plugin-ai-core-node';
import { createBedrockChat } from './chat';
import { BedrockTitanEmbeddings } from './embeddings';
import { createBedrockTranscription } from './transcription';
import { createBedrockRerank } from './reranking';
import { createBedrockGuardrail } from './guardrail';

export const aiCoreBackendModuleLlmAws = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'llm-aws',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        chat: chatModelsExtensionPoint,
        embeddings: embeddingsExtensionPoint,
        transcription: transcriptionExtensionPoint,
        reranking: rerankingExtensionPoint,
        guardrail: guardrailExtensionPoint,
      },
      async init({ config, logger, chat, embeddings, transcription, reranking, guardrail }) {
        // Embeddings (always supported by this provider)
        const bedrockEmbeddingsConfig = config.getOptionalConfig('ai.embeddings.bedrock');
        if (bedrockEmbeddingsConfig) {
          embeddings.addEmbeddings({ id: 'aws-bedrock', embeddings: new BedrockTitanEmbeddings(bedrockEmbeddingsConfig, logger) });
        }
        // Chat (optional — register when ai.models.aws config present)
        const bedrockChatConfig = config.getOptionalConfig('ai.models.aws');
        if (bedrockChatConfig) {
          chat.addChatModel({ id: 'aws-claude', model: createBedrockChat(bedrockChatConfig, logger) });
        }
        // Transcription (optional — register when ai.transcription.aws config present)
        const bedrockTranscriptionConfig = config.getOptionalConfig('ai.transcription.aws');
        if (bedrockTranscriptionConfig) {
          transcription.addTranscription({ id: 'aws-transcribe', transcribe: createBedrockTranscription(bedrockTranscriptionConfig, logger) });
        }
        // Reranking (optional — register when ai.reranking.aws config present)
        const bedrockRerankConfig = config.getOptionalConfig('ai.reranking.aws');
        if (bedrockRerankConfig) {
          reranking.addReranking({ id: 'aws-cohere-rerank', rerank: createBedrockRerank(bedrockRerankConfig, logger) });
        }
        // Guardrail (optional — register when ai.guardrail.bedrock config present)
        const bedrockGuardrailConfig = config.getOptionalConfig('ai.guardrail.bedrock');
        if (bedrockGuardrailConfig) {
          guardrail.addGuardrail({ id: 'aws-bedrock-guardrail', ...createBedrockGuardrail(bedrockGuardrailConfig, logger) });
        }
        logger.info('Registered AWS Bedrock providers (embeddings + optional chat/transcription/reranking/guardrail).');
      },
    });
  },
});
export default aiCoreBackendModuleLlmAws;
```

**Deletes**: `BedrockAugmenter.ts` and its test. The Cohere `input_type` + 66-doc batching logic moves into `embeddings/BedrockEmbeddings.ts` (unchanged behavior, renamed home).

## Package 10 — `plugin-ai-core-backend-module-llm-openai` → all capabilities it supports

OpenAI supports chat (GPT-4o family), embeddings (text-embedding-3), transcription (Whisper), reranking (via prompt-simulated Reranker), and guardrail (OpenAI Moderation) — all registered, each config-gated.

### Target `src` (after)

```bash
plugin-ai-core-backend-module-llm-openai/
  package.json
  tsconfig.json
  config.d.ts
  README.md
  src/
    index.ts
    setupTests.ts
    module.ts
    chat/
      index.ts
      OpenAiChat.ts          # GPT chat models (new)
      __tests__/OpenAiChat.test.ts
    embeddings/
      index.ts
      OpenAiEmbeddings.ts    # moved from OpenAiAugmenter.ts
      __tests__/OpenAiEmbeddings.test.ts
    transcription/
      index.ts
      WhisperTranscription.ts # Whisper client (new)
      __tests__/WhisperTranscription.test.ts
    reranking/
      index.ts
      OpenAiRerank.ts        # prompt-simulated reranker (new)
      __tests__/OpenAiRerank.test.ts
    guardrail/
      index.ts
      OpenAiModeration.ts     # OpenAI Moderation API (new)
      __tests__/OpenAiModeration.test.ts
```

`src/module.ts` registers into every category OpenAI supports, each config-gated (`ai.models.openai`, `ai.embeddings.openai`, `ai.transcription.openai`, `ai.reranking.openai`, `ai.guardrail.openai`).

**Deletes**: `OpenAiAugmenter.ts` and its test. Embedding client logic moves into `embeddings/OpenAiEmbeddings.ts`.
plugin-ai-core-backend-module-llm-openai/
  package.json
  tsconfig.json
  config.d.ts
  README.md
  src/
    index.ts
    setupTests.ts
    module.ts
    chat/
      index.ts
      OpenAiChat.ts          # GPT chat models (new)
      __tests__/OpenAiChat.test.ts
    embeddings/
      index.ts
      OpenAiEmbeddings.ts    # moved from OpenAiAugmenter.ts
      __tests__/OpenAiEmbeddings.test.ts
    transcription/
      index.ts
      WhisperTranscription.ts # Whisper client (new)
      __tests__/WhisperTranscription.test.ts
```

`src/module.ts` registers into every category OpenAI supports, each config-gated (`ai.models.openai`, `ai.embeddings.openai`, `ai.transcription.openai`).

**Deletes**: `OpenAiAugmenter.ts` and its test. Embedding client logic moves into `embeddings/OpenAiEmbeddings.ts`.

## Package 11 — `plugin-ai-core-backend-module-llm-openrouter` → all capabilities it supports

OpenRouter aggregates many providers (Anthropic, Meta, Google, OpenAI) through a unified API. It supports chat, embeddings, and transcription; it does not host a dedicated reranker or a standalone guardrail API today. The registrations that do exist (chat, embeddings, transcription) are config-gated; the two that do not (reranking, guardrail) are simply omitted from this provider's module until OpenRouter adds them.

### Target `src` (after)

```
plugin-ai-core-backend-module-llm-openrouter/
  package.json  tsconfig.json  config.d.ts  README.md
  src/
    index.ts  setupTests.ts
    module.ts                 # rewire: chatModelsExtensionPoint.addChatModel instead of modelExtensionPoint
    chat/
      index.ts
      OpenRouterChat.ts       # moved from OpenRouterModel.ts
      __tests__/OpenRouterChat.test.ts
    embeddings/
      index.ts
      OpenRouterEmbeddings.ts # moved from OpenRouterModel.ts
      __tests__/OpenRouterEmbeddings.test.ts
    transcription/
      index.ts
      OpenRouterTranscription.ts # /audio/transcriptions endpoint
      __tests__/OpenRouterTranscription.test.ts
```

**Deletes**: `OpenRouterModel.ts` and its test. Chat model logic moves into `chat/OpenRouterChat.ts`. Embeddings and transcription registrations are added under `ai.embeddings.openrouter` and `ai.transcription.openrouter` config keys.

## Package 12 — `plugin-ai-core-backend-module-retrieval-augmenter` → composition

Replace hard-coded store/embedder construction with resolution from extension points. This is the architectural inversion fix.

### Target `src` (after)

```bash
src/
  index.ts
  setupTests.ts
  defaultInitializer.ts       # exports createDefaultRetrievalPipeline + createIndexer
  compose.ts                  # NEW: resolves embedder + active vector store from extension points
  indexing/
    index.ts
    DefaultVectorAugmentationIndexer.ts
  retrieval/
    index.ts
    DefaultRetrievalPipeline.ts
    postProcessors/
    CombiningPostProcessor.ts
    retrievers/
    SearchClient.ts
    SearchRetriever.ts
    VectorEmbeddingsRetriever.ts
    routers/  SourceBasedRetrievalRouter.ts
  @types/index.ts
```

`src/compose.ts`:

```ts
import { Config } from '@backstage/config';
import {
  EmbeddingsDefinition,
  VectorStoreDefinition,
  VectorStore,
  Embeddings,
} from '@webstackbuilders/plugin-ai-core-node';

export function resolveCompose(options: {
  embedders: EmbeddingsDefinition[];
  stores: VectorStoreDefinition[];
  config: Config;
}): { embedder: Embeddings; store: VectorStore } {
  const { embedders, stores, config } = options;
  const embedderId = config.getOptionalString('ai.embeddings.provider') ?? embedders[0]?.id;
  const storeId = config.getOptionalString('ai.embeddings.store') ?? stores[0]?.id;
  const embedder = embedders.find(p => p.id === embedderId)?.embeddings;
  const store = stores.find(p => p.id === storeId)?.store as VectorStore | undefined;
  if (!embedder) throw new Error(`No embeddings provider registered for '${embedderId}'`);
  if (!store) throw new Error(`No vector store registered for '${storeId}'`);
  return { embedder, store };
}
```

The module owns the resolution of active embedder + active store; `defaultInitializer` and `DefaultVectorAugmentationIndexer` consume them without hard-coding pgvector. Removes direct factory imports of storage packages from LLM modules.

---

## Execution Sequence

Do not maintain backward compatibility. Ordered by dependency; each step gates the next.

1. **Package 0 — Core-node rename**: rename `plugin-ai.storage.vector` extension point ID to `plugin-ai.vector.storage` (symbol stays `vectorStoreExtensionPoint`). Verify no code breakage in core-backend.
2. **Package 1 — `module-models-chat`** (new core module): scaffold the chat model registry + extension point.
3. **Package 2 — `module-models-embeddings`** (new core module): scaffold the embeddings registry + extension point.
4. **Package 3 — `module-models-transcription`** (new core module): scaffold the transcription registry + extension point.
5. **Package 4 — `module-models-reranking`** (new core module): scaffold the reranking registry + extension point.
6. **Package 5 — `module-models-guardrail`** (new core module): scaffold the guardrail registry + extension point.
7. **Package 6 — `module-vector-storage`** (new core module): scaffold the vector store registry + extension point (renamed from `storage-vector`).
8. **Package 7 — `module-vector-storage-pgvector`** → provider: register via the new extension point (id `pgvector`).
9. **Package 8 — `module-vector-storage-qdrant`** → provider: register via the new extension point (id `qdrant`).
10. **Package 9 — `module-llm-aws`** → all capabilities: chat + embeddings + transcription + reranking + guardrail, config-gated.
11. **Package 10 — `module-llm-openai`** → all capabilities: chat + embeddings + transcription + reranking + guardrail, config-gated.
12. **Package 11 — `module-llm-openrouter`** → all capabilities it supports: chat + embeddings + transcription, config-gated.
13. **Package 12 — `module-retrieval-augmenter`** → composition: replace hard-coded `createPgVectorStore` with `compose.ts` resolution from extension points.

Note: steps 2-7 require step 1 (extension point rename); step 13 requires steps 7-8; steps 9-12 can run in parallel with steps 2-8.

## Validation (no typecheck/lint/test run per current instruction)

- `module-vector-storage`: registry rejects duplicate registrations; `resolve` throws explicit error on unknown ID; config defaults to first registered when key missing.
- `module-vector-storage-pgvector`/`-qdrant`: `module.test.ts` asserts registration with a mocked `vectorStoreExtensionPoint`; `createPgVectorStore` continues to run migrations.
- `module-retrieval-augmenter`: `compose` picks embedder + store from config; no direct imports of `createPgVectorStore`/`createQdrantVectorStore` from storage packages anywhere in this group.
- `llm-*`: registration-only shapes; each capability registration config-gated; `BedrockAugmenter`/`OpenAiAugmenter` deleted; module tests register against mocked extension points.
- Verify no group member imports a storage factory from another group member — grep the group for cross-imports (llm → storage is inverted; llm → retrieval-augmenter is only through extension points).

## Done criteria for this group

- The vector-storage core module owns the active vector store decision.
- LLM provider modules are pure registrations against their extension points (no direct storage factory imports).
- Retrieval-augmenter composes embedder + store by config and extension points; pgvector and qdrant are both reachable.
- The architectural inversion is repaired; new providers (e.g. a new vector store or embedder) require zero code changes in core plugins — a third-party plugin registers a driver.
- Naming is consistent: `vector-storage` packages + `plugin-ai.vector.storage` extension point ID, aligned across repo docs.

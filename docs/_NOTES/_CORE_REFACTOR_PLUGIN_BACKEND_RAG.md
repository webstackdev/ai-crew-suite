# RAG Group Refactor — LLM, Storage, Retrieval

Implementation plan for the retrieval/RAG group: the model capability modules (LLM providers), vector storage providers, and the retrieval-augmenter composition. This follows the same pattern as `_CORE_REFACTOR_PLUGIN_BACKEND_NODE.md` and `_CORE_REFACTOR_PLUGIN_BACKEND_CORE.md`, per the canonical `_CORE_REFACTOR.md` plan §5.5 / §11.

**Group members** (7 existing packages + 1 new core module):
- `plugin-ai-core-backend-module-llm-aws`
- `plugin-ai-core-backend-module-llm-openai`
- `plugin-ai-core-backend-module-llm-openrouter`
- `plugin-ai-core-backend-module-storage-pgvector`
- `plugin-ai-core-backend-module-storage-qdrant`
- `plugin-ai-core-backend-module-retrieval-augmenter`
- NEW: `plugin-ai-core-backend-module-storage-vector` (core extension module)

**Self-contained**: assume `plugin-ai-core-node` is refactored (provides `chatModelsExtensionPoint`, `embeddingsExtensionPoint`, `vectorStoreExtensionPoint`, `ChatModelDefinition`, `EmbeddingsDefinition`, `VectorStoreDefinition`, and `EmbeddingsSource`/`VectorStore` contracts). This document fully specifies the RAG-group refactor independent of the core-backend engine.

**Ground rules**: no backward compatibility. The current inversion (LLM modules import and instantiate `createPgVectorStore` / `createQdrantVectorStore` directly; retrieval-augmenter composes whatever store an LLM module happened to pick) is broken. Providers become pure registrations; retrieval-augmenter composes embedder + store from extension points.

---

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
storage-pgvector module.ts   │   storage-vector (core module) holds
  vectorStoreExtensionPoint.addVectorStore({id:'pgvector', store})  ◄── the Map
                             │            │
storage-qdrant module.ts     │            │
  vectorStoreExtensionPoint.addVectorStore({id:'qdrant', store})    │
                             │            │
        retrieval-augmenter  │            │
          resolves embedder + active store from extension points    ▼
          by config (ai.embeddings.store: 'pgvector' | 'qdrant')
```

Each provider is a pure registration. Retrieval-augmenter composes. No LLM module imports a storage factory.

---


## Package 1 — NEW core module: `plugin-ai-core-backend-module-storage-vector`

The vector-store registry core module (the "core extension" for storage, analogous to `module-vcs` for VCS or `module-observability` for observability). Owns the `Map`, the extension point, config-driven resolution, and exposes the active store.

### Structure (new package)

```bash
plugin-ai-core-backend-module-storage-vector/
  package.json
  tsconfig.json
  config.d.ts
  README.md
  src/
    index.ts
    module.ts
    registry.ts          # internal Map<string, VectorStoreDefinition> + resolve()
    config.ts            # reads ai.embeddings.store / ai.embeddings.provider
    __tests__/module.test.ts
              registry.test.ts
```

`src/registry.ts`:

```ts
import { VectorStoreDefinition } from '@webstackbuilders/plugin-ai-core-node';
import { VectorStore } from '@webstackbuilders/plugin-ai-core-node';

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
        `Import the matching @webstackbuilders/plugin-ai-core-backend-module-storage-<provider> package.`,
      );
    }
    return def.store as VectorStore;
  }
  list(): VectorStoreDefinition[] {
    return [...this.stores.values()];
  }
}
```

`src/config.ts`: reads `ai.embeddings.store: string` (e.g. `'pgvector'` or `'qdrant'`) — default to `'pgvector'` for convenience but allow any registered ID.

`src/module.ts`: exposes the extension point; on init, resolves the configured store and re-exports it as the active `VectorStore` for retrieval-augmenter to consume.

This is the single place where "which vector store is active" is decided.

## Package 2 — `plugin-ai-core-backend-module-storage-pgvector` → provider

Convert from factory-export to pure provider registration.

### Current `src` (before)

```
src/
  index.ts
  setupTests.ts
  @types/index.ts
  service/index.ts
          PgVectorStore.ts
          __tests__/index.test.ts
                    PgVectorStore.test.ts
  database/migrations.ts
           __tests__/migrations.test.ts
```

### Target `src` (after) — adds module.ts

```
src/
  index.ts
  module.ts                 # NEW: registers via vectorStoreExtensionPoint
  setupTests.ts
  @types/index.ts
  service/index.ts          # keep createPgVectorStore factory (used internally)
          PgVectorStore.ts
          __tests__/index.test.ts
                    PgVectorStore.test.ts
  database/migrations.ts
           __tests__/migrations.test.ts
```

`src/module.ts`:

```ts
import { createBackendModule, coreServices } from '@backstage/backend-plugin-api';
import { vectorStoreExtensionPoint } from '@webstackbuilders/plugin-ai-core-node';
import { createPgVectorStore } from './service';
import { readPgVectorConfig } from './config';

export const aiCoreBackendModuleStoragePgVector = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'storage-vector-pgvector',
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
export default aiCoreBackendModuleStoragePgVector;
```

- Keep `service/index.ts` `createPgVectorStore` export (used by the module internally; the factory function itself is unchanged).
- `database/migrations.ts` unchanged (still runs via `coreServices.database`).
- `module.test.ts` asserts registration with a mocked `vectorStoreExtensionPoint`.


## Package 3 — `plugin-ai-core-backend-module-storage-qdrant` → provider

Same conversion as pgvector, mirroring structure.

```
plugin-ai-core-backend-module-storage-qdrant/
  package.json  tsconfig.json  config.d.ts  README.md
  src/
    index.ts  setupTests.ts
    module.ts               # NEW: registers via vectorStoreExtensionPoint (id: 'qdrant')
    @types/index.ts
    service/index.ts        # keep createQdrantVectorStore factory internally
    service/QdrantVectorStore.ts
    service/__tests__/index.test.ts
    service/__tests__/QdrantVectorStore.test.ts
    setupTests.ts
```

`src/module.ts` mirrors the pgvector module but registers `{ id: 'qdrant', store }`.

## Package 4 — `plugin-ai-core-backend-module-llm-aws` → embeddings (+ optional chat/guardrail)

Convert from self-contained to pure provider registration(s). The chat/guardrail registrations are additive options; the embeddings registration is the required one.

### Current `src` (before)

```
src/
  index.ts  setupTests.ts
  BedrockAugmenter.ts
  BedrockCohereEmbeddings.ts
  __tests__/BedrockAugmenter.test.ts
  __tests__/BedrockCohereEmbeddings.test.ts
  __tests__/module.test.ts
```

### Target `src` (after)

```
src/
  index.ts  setupTests.ts
  module.ts                 # rewire: register embeddings (chat/guardrail optional)
  embeddings/
    index.ts
    BedrockEmbeddings.ts    # moved from BedrockAugmenter.ts (Titan; requires input_type wrapper logic)
    BedrockCohereEmbeddings.ts
    __tests__/BedrockEmbeddings.test.ts
    __tests__/BedrockCohereEmbeddings.test.ts
  chat/                     # optional: Claude-on-Bedrock chat models
    index.ts
    __tests__/index.test.ts
  guardrail/                # optional: Bedrock Guardrails
    index.ts
    __tests__/index.test.ts
```

`src/module.ts` rewrites to register embeddings provider:

```ts
import { createBackendModule, coreServices } from '@backstage/backend-plugin-api';
import {
  embeddingsExtensionPoint,
  chatModelsExtensionPoint,
  guardrailExtensionPoint,
} from '@webstackbuilders/plugin-ai-core-node';
import { BedrockTitanEmbeddings } from './embeddings/BedrockEmbeddings';
import { BedrockConfig } from './@types'; // adjust import to actual config type
import { createClaudeChat } from './chat';
import { createBedrockGuardrail } from './guardrail';

export const aiCoreBackendModuleLlmAws = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'llm-aws-bedrock',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        embeddings: embeddingsExtensionPoint,
        // optional: chat/guardrail bound to provider config availability
      },
      async init({ config, logger, embeddings /*, chat, guardrail */ }) {
        const bedrockConfig = config.get<BedrockConfig>('ai.embeddings.bedrock');
        embeddings.addEmbeddings({
          id: 'aws-bedrock',
          embeddings: new BedrockTitanEmbeddings(bedrockConfig, logger),
        });
        logger.info('Registered AWS Bedrock embeddings provider.');
        // chat/guardrail registrations added when config present (optional)
      },
    });
  },
});
export default aiCoreBackendModuleLlmAws;
```

**Deletes**: `BedrockAugmenter.ts` and `BedrockAugmenter.test.ts`. The naming "Augmenter" is wrong now — it's an embeddings provider. Move `input_type`/batching logic into `embeddings/BedrockEmbeddings.ts` (renamed from the old augmenter; pure embedding client).

**Optional registrations** (chat, guardrail): under `chat/`, `guardrail/` sub-directories with their own tests. BedrockTitan/Cohere batching logic from `BedrockCohereEmbeddings.ts` preserved (it's a real constraint — Cohere `input_type` + 66-doc batch limit).


## Package 5 — `plugin-ai-core-backend-module-llm-openai` → embeddings (+ chat + transcription optional)

### Current `src` (before)

```
src/
  index.ts  setupTests.ts
  OpenAiAugmenter.ts
  __tests__/module.test.ts
  __tests__/OpenAiAugmenter.test.ts
```

### Target `src` (after)

```
src/
  index.ts  setupTests.ts
  module.ts
  embeddings/
    index.ts
    OpenAiEmbeddings.ts     # moved from OpenAiAugmenter.ts
    __tests__/OpenAiEmbeddings.test.ts
  chat/                     # optional: GPT chat models
    index.ts
    __tests__/index.test.ts
  transcription/            # optional: Whisper
    index.ts
    __tests__/index.test.ts
```

`src/module.ts` registers embeddings provider (always), chat + Whisper optionally when the config keys are present.

**Deletes**: `OpenAiAugmenter.ts` and its test. Moves embedding client into `embeddings/OpenAiEmbeddings.ts`.

## Package 6 — `plugin-ai-core-backend-module-llm-openrouter` → chat only

Already chat-only (validated: registers only to `modelExtensionPoint` today). Conversion is the smallest.

### `src` (before and after — same shape)

```
src/
  index.ts  setupTests.ts
  module.ts                 # rewire: chatModelsExtensionPoint.register instead of modelExtensionPoint
  OpenRouterModel.ts
  __tests__/module.test.ts
  __tests__/OpenRouterModel.test.ts
```

`module.ts` change: replace `modelExtensionPoint` deps with `chatModelsExtensionPoint`. `OpenRouterModel.ts` client's return contract changes minimally: from `ModelDefinition` to `ChatModelDefinition` (`{ id, model: BaseChatModel }`). The `createOpenRouterModels` loop registers to the new chat point.

## Package 7 — `plugin-ai-core-backend-module-retrieval-augmenter` → composition

Replace hard-coded store/embedder construction with resolution from extension points. This is the architectural inversion fix.

### Current `src` (before)

```
src/
  index.ts  setupTests.ts
  defaultInitializer.ts       # NEW-style pipeline entry point (exports createDefaultRetrievalPipeline)
  indexing/
    index.ts  DefaultVectorAugmentationIndexer.ts
    __tests__/DefaultVectorAugmentationIndexer.test.ts
  retrieval/
    index.ts  DefaultRetrievalPipeline.ts  __tests__/DefaultRetrievalPipeline.test.ts
    postProcessors/  CombiningPostProcessor.ts  __tests__/...
    retrievers/  SearchClient.ts  SearchRetriever.ts  VectorEmbeddingsRetriever.ts  __tests__/...
    routers/  SourceBasedRetrievalRouter.ts  __tests__/...
  @types/index.ts
```

### Target `src` (after)

```
src/
  index.ts  setupTests.ts
  defaultInitializer.ts       # still exports createDefaultRetrievalPipeline + createIndexer
  compose.ts                  # NEW: resolves embedder + active vector store from extension points
  indexing/
    index.ts  DefaultVectorAugmentationIndexer.ts
  retrieval/
    index.ts  DefaultRetrievalPipeline.ts
    postProcessors/  CombiningPostProcessor.ts
    retrievers/  SearchClient.ts  SearchRetriever.ts  VectorEmbeddingsRetriever.ts
    routers/  SourceBasedRetrievalRouter.ts
  @types/index.ts
```

`src/compose.ts`:

```ts
import {
  embeddingsExtensionPoint,
  vectorStoreExtensionPoint,
} from '@webstackbuilders/plugin-ai-core-node';
import { Embeddings, VectorStore } from '@webstackbuilders/plugin-ai-core-node';
import { Config } from '@backstage/config';

export function resolveCompose({
  embeddingsPoint,
  vectorStorePoint,
  config,
}: {
  embeddingsPoint: EmbeddingsDefinition[];
  vectorStorePoint: VectorStoreDefinition[];
  config: Config;
}): { embedder: Embeddings; store: VectorStore } {
  const embedderId = config.getOptionalString('ai.embeddings.provider')
    ?? (embeddingsPoint[0]?.id);
  const storeId = config.getOptionalString('ai.embeddings.store')
    ?? (vectorStorePoint[0]?.id);

  const embedder = embeddingsPoint.find(p => p.id === embedderId)?.embeddings;
  const store = vectorStorePoint.find(p => p.id === storeId)?.store as VectorStore | undefined;

  if (!embedder) throw new Error(`No embeddings provider registered for '${embedderId}'`);
  if (!store) throw new Error(`No vector store registered for '${storeId}'`);
  return { embedder, store };
}
```

The module owns the resolution of active embedder + active store; `defaultInitializer` and `DefaultVectorAugmentationIndexer` consume them without hard-coding pgvector. Removes direct factory imports.

**Optional**: `plugin-ai-core-backend-module-models-embeddings` (core module for the embeddings category) might own the registry; if so, retrieval-augmenter consumes from that core module instead of calling the extension point directly. Either shape is acceptable — the point is the inversion fix.

---


## Execution Sequence

Do not maintain backward compatibility. This is a greenfield refactor. The below is parallel to the dependency direction (storage-vector consumes no other group member; retrieval-augmenter consumes all providers). Deps work expect externals are complete.

1. **Package 1 — `plugin-ai-core-backend-module-storage-vector`** (new core module): create the vector store registry, extension point, and resolution logic. This is a pure scaffold; no other group member depends on it yet.
2. **Package 2 — `plugin-ai-core-backend-module-storage-pgvector`** → provider: convert to register pgvector with `id: 'pgvector'` via the `vectorStoreExtensionPoint`.
3. **Package 3 — `plugin-ai-core-backend-module-storage-qdrant`** → provider: convert to register qdrant with `id: 'qdrant'` via the same point.
4. **Package 7 — `plugin-ai-core-backend-module-retrieval-augmenter`** (composition): rewire from hard-coded `createPgVectorStore` to compose resolve of active embedder + active vector store from the extension points / `storage-vector` module, driven by config (`ai.embeddings.provider`, `ai.embeddings.store`).
5. **Package 4 — `plugin-ai-core-backend-module-llm-aws`** → embeddings (+ optional chat/guardrail): convert from self-contained to pure provider; delete `BedrockAugmenter`; register `aws-bedrock` embedder (+ optional Claude chat / Bedrock Guardrails when config present).
6. **Package 5 — `plugin-ai-core-backend-module-llm-openai`** → embeddings (+ optional chat/transcription): convert from self-contained to pure provider; delete `OpenAiAugmenter`; register `openai` embedder (+ optional GPT chat / Whisper transcription when config present).
7. **Package 6 — `plugin-ai-core-backend-module-llm-openrouter`** → chat only: rewire from `modelExtensionPoint` to `chatModelsExtensionPoint`; `OpenRouterModel` returns `ChatModelDefinition`.

Note: steps 2-3 require package 1 to exist; steps 4-6 require packages 2-3 to exist (or degrade to "no store through config" error at boot).

## Validation (no typecheck/lint/test run per current instruction)

- `plugin-ai-core-backend-module-storage-vector`: registry rejects duplicate registrations; `resolve` throws an explicit error on unknown ID; config defaults to first registered if missing.
- `plugin-ai-core-backend-module-storage-pgvector`/`-qdrant`: `module.test.ts` asserts registration with a mocked `vectorStoreExtensionPoint`. `createPgVectorStore` continues to run migrations (module.test).
- `plugin-ai-core-backend-module-retrieval-augmenter`: `compose` picks embedder + store from config; direct factory imports (`createPgVectorStore`/`createQdrantVectorStore`) are absent from non-storage packages.
- `plugin-ai-core-backend-module-llm-*`: registration-only shapes; `BedrockAugmenter`/`OpenAiAugmenter` deleted; `embeddings/BedrockEmbeddings.ts` contains only client logic (batching, `input_type` if Cohere); module tests register against mocked extension points.
- Verify no group member imports `createPgVectorStore`/`createQdrantVectorStore` from a different group member — grep the group for cross-imports (llm → storage is inverted, llm → retrieval-augmenter is only extended through extension points).

## Done criteria for this group

- The storage-vector core module owns the active vector store decision.
- LLM provider modules are pure registrations against their extension points (no direct storage factory imports).
- Retrieval-augmenter composes embedder + store by config and extension points; pgvector and qdrant are both reachable.
- The architectural inversion is repaired; new providers (e.g. a new vector store or embedder) require zero code changes in core plugins — a third-party plugin registers a driver.


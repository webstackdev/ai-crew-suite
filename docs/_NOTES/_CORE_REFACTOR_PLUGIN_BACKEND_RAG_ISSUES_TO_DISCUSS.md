# Core Refactor of LLM Extensions (Bedrock and OpenRouter)

## LLM modules are doing two unrelated jobs

This is one of the problems in our current code that this refactor is trying to fix.

Looking at `module-llm-aws/src/module.ts` lines 50-110, it:

- Creates a **pgvector store** directly (`createPgVectorStore({...})`) — line 57
- Creates a **Bedrock embeddings augmenter** (`new BedrockAugmenter({...})`) — line 69
- Creates a **retrieval pipeline** (`createDefaultRetrievalPipeline({...})`) — line 82
- Registers a **retrieval tool** (`aws.bedrock.retrieval`) — line 85

It's doing **embeddings + vector storage + retrieval orchestration** all in one module. There's no chat model here at all.

Compare to `module-llm-openrouter/src/module.ts`:

```ts
for (const model of createOpenRouterModels({...})) {
  models.addModel(model);  // registers chat models only
}
```

This is **chat models only**, no embeddings, no storage. But OpenRouter does provide models implementing the full set of modalities we want to make available to our agentic workflow plugins. Any given provider can change what models they offer over time - they may not offer a modality today, and offer it in the future; they may offer it today and discontinue them in the future. Our design needs to allow for that, and also that a user of our project might use multiple providers (although they would only use one provider and model per capability at a time - perhaps GPT-5.6 for reasoning, and Meta's safety model for guardrail).

So the LLM modules are inconsistent in what they provide — they're not really "LLM provider modules" in a uniform sense.
### 3. **Storage modules are incomplete (missing the "core" half)**

The storage modules (`storage-pgvector`, `storage-qdrant`) are **store implementations only** — they export `createPgVectorStore()` / `createQdrantVectorStore()` factory functions, but:

- No extension point to register a store
- No config-driven resolution of which store to use
- No tool factory that exposes store operations as `ToolDefinition`s

They're missing the "core extension plugin" layer that would make them match the VCS pattern.

## Multi-Modal Capabilities

We want to allow agentic workflow plugins to access models that have transcription, vision, reranking, classification, and guardrail capabilities:

| Model type     | LangChain interface          | Example use case                                |
| :------------- | :--------------------------- | :---------------------------------------------- |
| Chat models    | `BaseChatModel`              | Current: GPT-4o, Claude 3.5 Sonnet              |
| Embeddings     | `Embeddings`                 | Current: Bedrock Titan, OpenAI text-embedding-3 |
| Transcription  | `AudioLoader` / custom       | Whisper API for voice notes                     |
| Vision         | `BaseChatModel` (multimodal) | GPT-4o parsing Grafana screenshots              |
| Reranking      | `Reranker`                   | Cohere Rerank for retrieval pipeline            |
| Classification | Custom / `BaseChatModel`     | Severity tagging (P1/P2/P3)                     |
| Guardrails     | Custom classifier            | Llama Guard for prompt safety                   |

### What the correct structure looks like

We need **capability-category modules** (like VCS) for each model type:

```javascript
plugin-ai-core-backend-module-models-chat
  → chatModelsExtensionPoint (replaces modelExtensionPoint)
  → registers chat models (BaseChatModel only — drop BaseLLM)

plugin-ai-core-backend-module-models-embeddings
  → embeddingsExtensionPoint
  → registers Embeddings implementations
  → config-driven resolution of active embedder

plugin-ai-core-backend-module-models-transcription
  → transcriptionExtensionPoint
  → registers Whisper/etc. clients

plugin-ai-core-backend-module-models-reranking
  → rerankingExtensionPoint
  → registers Cohere Rerank/etc.

plugin-ai-core-backend-module-storage-vector
  → vectorStoreExtensionPoint
  → registers VectorStore implementations (pgvector, qdrant)
  → config-driven resolution of active store
  → exposes vectorStore.* tools (similarity search, etc.)

plugin-ai-core-backend-module-models-guardrail
  → guardrailModelsExtensionPoint
  → GuardrailModel contract: classify(input: { text, direction: 'input'|'output' })
      → { verdict: 'safe'|'unsafe', categories: string[], score?: number }
```

Then provider modules become pure suppliers:

```test
plugin-ai-core-backend-module-llm-openai
  → registers: chat models (GPT-4o), embeddings (text-embedding-3), transcription (Whisper)

plugin-ai-core-backend-module-llm-aws
  → registers: chat models (Claude via Bedrock), embeddings (Titan), guardrails (Bedrock Guardrails API)

plugin-ai-core-backend-module-llm-cohere
  → registers: reranking models

plugin-ai-core-backend-module-llm-openai
  → registers: all categories of model capabilities

plugin-ai-core-backend-module-storage-pgvector
  → registers: PgVectorStore into vectorStoreExtensionPoint

plugin-ai-core-backend-module-storage-qdrant
  → registers: QdrantVectorStore into vectorStoreExtensionPoint
```

The **retrieval-augmenter** (`plugin-ai-core-backend-module-retrieval-augmenter`) then composes: active embedder + active vector store → indexer/retriever (instead of LLM modules hard-coding `createPgVectorStore`).

## Vector Storage Tools

1. Retrieval & Query Tools (Read Ops)

These are the primary tools your LLM agents will invoke to gather context during a LangGraph workflow.

- `vector_store.collection.similarity_search`
  - **Purpose:** The standard semantic search. Takes a text query, embeds it via your Embeddings plugin, and finds the closest matching documents.
  - **Arguments:** `query: string`, `collection: string`, `limit?: number`.
- `vector_store.collection.filtered_search`
  - **Purpose:** Crucial for multi-tenant or multi-project Spotify Backstage instances. Allows the agent to query semantic data constrained by specific Backstage catalog entities, namespaces, or tags.
  - **Arguments:** `query: string`, `collection: string`, `filter: object` (e.g., `{"component": "auth-service"}`), `limit?: number`.
- `vector_store.document.get_by_id`
  - **Purpose:** Allows an agent to fetch the raw text content or metadata of a specific chunk if it already knows the document reference from a previous search.
  - **Arguments:** `id: string`, `collection: string`.
- Ingestion & Memory Tools (Write Ops)

These tools are valuable for Long-Term Memory (LTM) nodes in LangGraph or automated documentation-syncing background cron tasks in Backstage.

- `vector_store.document.upsert`
  - **Purpose:** Adds or updates content chunks in the active store. The backend handles chunking and automatically triggers your `Embeddings` plugin before writing to pgvector/qdrant.
  - **Arguments:** `content: string`, `metadata: object`, `collection: string`, `id?: string`.
- `vector_store.document.delete`
  - **Purpose:** Essential for maintaining a clean store. For example, if a Backstage component is deleted or a repository file is removed, the agent can clean up obsolete embeddings.
  - **Arguments:** `id: string`, `collection: string`.
- `vector_store.collection.clear`
  - **Purpose:** Wipes an entire collection. Highly useful for administrative agents or testing workflows within your Backstage monorepo.
  - **Arguments:** `collection: string`.
- Collection Management Tools (Admin Ops)

Depending on how abstract your `vectorStoreExtensionPoint` is, letting agents dynamically create namespaces for new teams/plugins keeps your Backstage platform highly modular.

- `vector_store.collection.list`
  - **Purpose:** Allows an agent or a Backstage UI component to inspect which data silos (collections) currently exist.
  - **Arguments:** None.
- `vector_store.collection.create`
  - **Purpose:** Automatically provisions a new table (pgvector) or collection (Qdrant) with the appropriate vector dimensions dictated by your configuration.
  - **Arguments:** `collection: string`, `vector_size: number`, `distance_metric: "cosine" | "l2" | "dot"`.

### Implementation

We need to rely entirely on Backstage's dependency injection (DI) system and **Extension Points** to decouple capabilities from providers. The solution we're trying to implement solves this problem among others:

> A given provider like OpenAI provides either all or a subset of models matching the capabilities we want to incorporate. That set could change over time; OpenAI (or any other AI provider) might drop all of their safety/guardrail models in the future, or add them if they don't have them now (and the same for any other capability).
>
> There's config per model that should be maintained per provider - for example, the configuration for the Meta safety model is very different than the config for AWS or Azure's safety models.

### The Correct Architectural Mental Model

In Backstage, a **Capability** (e.g., `plugin-ai-core-backend-module-models-chat`) should only own the **Extension Point interface** (the contract) and the registry. It should have **zero knowledge** of which providers exist.

Conversely, a **Provider** (e.g., `plugin-ai-core-backend-module-llm-openai`) should simply act as a client that satisfies those contracts. It should only import the Extension Points it actually implements, registering its specific models into them.

Here is how you handle your specific architectural dilemmas:

#### Decouple via Config, Not Code

Do not create hardcoded code dependencies between capabilities and providers. Use Backstage's `config` to resolve what is active.

```yaml
# app-config.yaml
ai:
  chat:
    activeProvider: openai
    activeModel: gpt-4o
  guardrails:
    activeProvider: aws # Completely different provider handled seamlessly
    activeModel: bedrock-default
  openai:
    apiKey: ${OPENAI_API_KEY}
    models:
      gpt-4o:
        temperature: 0.7
  aws:
    region: us-east-1
```

#### Shifting Capabilities (Providers adding/dropping features)

If OpenAI drops guardrails or adds them, **no code in your capability plugins changes**.

- If OpenAI supports Chat and Embeddings, its plugin internal code bootstraps and grabs `chatModelsExtensionPoint` and `embeddingsExtensionPoint`, registering itself.
- If OpenAI adds Guardrails tomorrow, you simply update the OpenAI module to tap into `guardrailModelsExtensionPoint` and register a new class. The Guardrail capability plugin remains untouched.

#### Handling Wildly Different Configurations

The Meta, AWS, and Azure safety model configurations look completely different. **This configuration should live under the provider's configuration namespace**, not the capability's namespace. The provider module is responsible for reading its own specific config structure and instantiating the unified contract object.

### Refined Implementation Blueprint

This is a plan suggested by Gemini without context from our code base. So this should be considered as a suggestion that can be pushed back on or modified.

#### Category-Specific Definitions & Extensions

Instead of a generic `ModelDefinition`, you will export type-safe contracts from `plugin-ai-core-node`.

```typescript
// plugins/backend/plugin-ai-core-node/src/types.ts
export interface ChatModelDefinition {
  providerId: string;
  modelId: string;
  instance: BaseChatModel;
}

export interface EmbeddingsDefinition {
  providerId: string;
  modelId: string;
  instance: Embeddings;
}
```

Your capability modules (`plugin-ai-core-backend-module-models-chat`, etc.) then define and export the matching `ExtensionPoints`:

```typescript
// plugins/backend/plugin-ai-core-backend-module-models-chat/src/extensions.ts
import { createExtensionPoint } from '@backstage/backend-plugin-api';
import { ChatModelDefinition } from '@internal/plugin-ai-core-node';

export interface ChatModelsExtensionPoint {
  registerChatModel(definition: ChatModelDefinition): void;
}

export const chatModelsExtensionPoint = createExtensionPoint<ChatModelsExtensionPoint>({
  id: 'ai-core.models.chat',
});
```

#### Pure Provider Registrations (Decoupled `llm-*`)

Your provider modules now have **zero knowledge** of each other or a monolithic core config. They import only the capability extension points they can actually satisfy.

```typescript
// plugins/backend/plugin-ai-core-backend-module-llm-openai/src/module.ts
import { createBackendModule, coreServices } from '@backstage/backend-plugin-api';
import { chatModelsExtensionPoint } from '@internal/plugin-ai-core-backend-module-models-chat';
import { embeddingsExtensionPoint } from '@internal/plugin-ai-core-backend-module-models-embeddings';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';

export const aiLlmOpenAiModule = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'llm-openai',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        chatExtension: chatModelsExtensionPoint,
        embeddingsExtension: embeddingsExtensionPoint,
      },
      async init({ config, chatExtension, embeddingsExtension }) {
        const apiKey = config.getString('ai.openai.apiKey');

        // Register Chat Capability
        chatExtension.registerChatModel({
          providerId: 'openai',
          modelId: 'gpt-4o',
          instance: new ChatOpenAI({ openAIApiKey: apiKey, modelName: 'gpt-4o' }),
        });

        // Register Embeddings Capability
        embeddingsExtension.registerEmbeddings({
          providerId: 'openai',
          modelId: 'text-embedding-3',
          instance: new OpenAIEmbeddings({ openAIApiKey: apiKey, modelName: 'text-embedding-3' }),
        });
      },
    });
  },
});
```

#### Vector Storage Integration (`storage-vector`)

The core vector store module defines how vector backends register themselves, using a config-driven lookup to determine which database is active globally.

```typescript
// plugins/backend/plugin-ai-core-backend-module-storage-vector/src/extensions.ts
import { createExtensionPoint } from '@backstage/backend-plugin-api';
import { VectorStore } from '@langchain/core/vectorstores';

export interface VectorStoreExtensionPoint {
  registerVectorStore(storeId: string, factory: (embeddings: Embeddings) => Promise<VectorStore>): void;
}

export const vectorStoreExtensionPoint = createExtensionPoint<VectorStoreExtensionPoint>({
  id: 'ai-core.storage.vector',
});
```

#### Composing the `retrieval-augmenter`

Your workflow engines or utility systems like the `retrieval-augmenter` stop hardcoding database instantiations. Instead, they accept the registries, read the application's active layout from config, and dynamically stitch the system together.

```typescript
// plugins/backend/plugin-ai-core-backend/src/services/RetrievalAugmenter.ts
import { Config } from '@backstage/config';
import { ChatModelRegistry, EmbeddingsRegistry, VectorStoreRegistry } from '../registries';

export class RetrievalAugmenter {
  constructor(
    private readonly config: Config,
    private readonly chatRegistry: ChatModelRegistry,
    private readonly embeddingsRegistry: EmbeddingsRegistry,
    private readonly vectorRegistry: VectorStoreRegistry,
  ) {}

  async composePipeline() {
    // 1. Resolve active keys from configuration safely
    const activeEmbedderProvider = this.config.getString('ai.retrieval.embeddings.provider');
    const activeEmbedderModel = this.config.getString('ai.retrieval.embeddings.model');
    const activeStoreId = this.config.getString('ai.retrieval.vectorStore.provider');

    // 2. Fetch the concrete instances out of the Extension Point Registries
    const embeddings = this.embeddingsRegistry.get(activeEmbedderProvider, activeEmbedderModel);
    
    // 3. Instantiate the configured database dynamically using the resolved embedder
    const vectorStoreFactory = this.vectorRegistry.getFactory(activeStoreId);
    const vectorStore = await vectorStoreFactory(embeddings);

    return {
      vectorStore,
      embeddings,
      // ready to run similarity search or inject into chains...
    };
  }
}
```

#### 🛡️ Why This Plan Scales Gracefully

1. **Isolated Failures**: If your `pgvector` container is down or its plugin fails initialization, your `llm-openai` and `models-chat` functionalities remain fully operational.
2. **Simplified Testing**: In your `__tests__` directories, you no longer have to mock deep transitive modules. You can simply instantiate an extension point registry object manually, push a mock `BaseChatModel` or dummy `VectorStore` into it, and test your code in absolute isolation.

## Guardrails

We've added a guardrail model capability in our proposal (`plugin-ai-core-backend-module-models-guardrail`). This is some notes we made about how it should work in the backend core plugin that handles the langgraph workflow.

The enforcement point is the engine itself: `ModelExecutor` runs input classification **before** dispatching to the chat model and output classification **on the streamed response** before tokens reach the SSE channel — configurable per agent (`ai.agents.<id>.guardrails: { input: true, output: true }`). An `unsafe` verdict becomes an `error` event with `code: 'guardrail_blocked'` (a new `ErrorCode`), never a leaked response. This composes with the redaction policy (redaction = *sanitize and proceed*; guardrails = *classify and halt*) and with the audit log (every block is audited). That's the enterprise content-safety story the compliance audit's Section H gestures at but doesn't specify.

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

## Naming Normalization

I've used the naming scheme so far in this document that we've discussed. But I want to normalize the naming schema for our storage plugins in our refactor plugin:

`plugin-ai-core-backend-module-storage-vector` to `plugin-ai-core-backend-module-vector-storage`

`plugin-ai-core-backend-module-storage-pgvector` to `plugin-ai-core-backend-module-vector-storage-pgvector`

`plugin-ai-core-backend-module-storage-qdrant` to `plugin-ai-core-backend-module-vector-storage-qdrant`

## What the core extension plugins (like `module-vcs`) do

Looking at `module-vcs/src/module.ts`, the core extension plugin acts as a **driver registry and tool factory coordinator**:

1. **Maintains a driver map** (`Map<string, VcsDriver>`) — line 35
2. **Exposes an extension point** (`vcsDriversExtensionPoint`) that provider modules use to register their drivers — line 38-42
3. **Reads config** to determine which provider is active (`readVcsConfig`) — line 52
4. **Resolves the driver** from the map using config — line 55
5. **Creates and registers tools** from the resolved driver (`createVcsTools({ driver, logger })`) — line 67-69

Then provider modules (like `module-vcs-github`) are **pure driver suppliers**:

```ts
// module-vcs-github/src/module.ts
vcsRegistry.registerDriver(githubDriver);  // line 52
```

They instantiate their provider-specific driver with credentials/config and register it into the core module's extension point. That's it.


# Core Refactor of LLM Extensions (Bedrock and OpenRouter)

You gave this recommendation:

>  Change `ModelDefinition.model` in core-node from `BaseLLM | BaseChatModel` to `BaseChatModel` only. The three LLM modules already comply; the typecheck will confirm. This also deletes the `BaseLLM` imports in core-backend's `plugin.ts`, `controller.ts`, and `factory.ts`.

I agree we should remove BaseLLM. But it also made me realize that we currently have two paths in our plugin-ai-core-backend-module-llm-* plugins: one for a chat interface, and another for the embeddings. I realized using the example of the oncall handover agent that we probably want to use models that have other interfaces:

1. Cross-Modal Models (Audio & Speech Processing)

For an on-call handover generator, the most impactful addition to your toolkit is speech-to-text processing. On-call engineers often don't have time to write detailed retrospective logs, but they can easily record a quick voice note summarizing an incident.

- **Speech-to-Text / Transcription Models (e.g., OpenAI Whisper):** In LangChain, these are handled via audio loader/transcription clients. An on-call handover agent can ingest a raw audio recording from an engineer, transcribe it, and pass the text to a chat model to format a structured Markdown handover note.
- **Text-to-Speech (TTS) Models:** Used if you want an agent to read summaries, alerts, or system status metrics aloud over phone lines or voice communication bridges during active high-severity incidents.

2. Multi-Modal Vision Models

Modern `BaseChatModel` implementations (like `GPT-4o` or `Claude 3.5 Sonnet`) natively process images alongside text strings.

- **Visual System Diagnostics:** An on-call handover agent can ingest screenshots of broken dashboards, Grafana charts, or cloud console stack traces that occurred during an outage. The agent parses the image to extract error text and timelines, injecting that diagnostic data directly into the finalized handover documentation.

3. **Reranking Models (e.g., Cohere Rerank):**

*What they do:* These models do not generate new text; they take an existing list of text documents and re-sort them based on semantic relevance to a query.

*Why you need them:* In your `RetrievalPipeline`, standard embedding search can pull back a noisy mix of old documentation or irrelevant slack logs. A reranking model sits at the end of your pipeline to ensure the top 3 documents provided to your agent are precisely related to the active incident.

4. **Code-Specialized & Local Fast Models (e.g., CodeLlama, Mistral-7B):**

*What they do:* Lightweight, high-speed open-weight models optimized for execution speed or strict security boundaries.

*Why you need them:* Running deep reasoning models for minor operations is expensive and slow. Your core engine can use a cheap, local code model for basic parsing tasks (e.g., parsing an incoming webhook payload into a flat schema block) while saving heavy reasoning models for final note generation.

5. Classification & Extraction Models

- **Cross-Encoders and Text Classifiers:** Instead of asking a large chat model to perform broad categorization via prompts, lightweight classification models are used to tag data streams. For instance, analyzing an incoming support ticket or alert payload to instantly classify its severity (`P1`, `P2`, `P3`) before deciding which LangGraph node path to take.

6. Safety & Guardrail Models

Common Examples: Meta Llama Guard (3, 3.2, or Vision alternatives), OpenAI Moderation API, or custom NeMo Guardrails endpoints.

*What they do:* These are highly specialized classifiers trained to evaluate incoming text prompts or outgoing agent responses against a structured taxonomy of risks (e.g., code injection attempts, data exfiltration risks, unsafe execution requests, or policy violations). They return a quick, deterministic classification verdict—usually safe or unsafe—along with a category tag.

## Questions

1. In the exension groups that relate to groups of third-party platforms, we have a structure where there is a core extension plugin (like `plugin-ai-core-backend-module-vcs`)  and individual plugins for individual platforms (like `plugin-ai-core-backend-module-vcs-github`). However, for LLMs and storage modules (like `plugin-ai-core-backend-module-llm-*` and `plugin-ai-core-backend-module-storage-*`), we do not have the core extension plugin and only have plugins for each provider. Why is that? What are the core extension plugins doing in the groups of third-party platforms?

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

## Why LLM and storage modules don't have this structure

**Short answer**: historical accident + different abstraction shapes. The LLM and storage groups grew organically without a forcing function to decouple them.

**The deeper answer** — three structural differences that made the VCS pattern necessary but seemingly optional for LLM/storage:

### 1. **VCS has many providers with the same contract; LLMs have few providers with different contracts**

- VCS: 8 providers (GitHub, GitLab, Bitbucket, Azure, Gerrit, etc.), all implementing `VcsDriver` with identical ops (`getRepositoryMetadata`, `readFile`, `searchRepository`, `listPullRequests`). High provider count + identical contract = decoupling pays off immediately.

- LLMs: 3 providers (AWS, OpenAI, OpenRouter), but each does **different things**:

  - AWS: embeddings only (no chat model registered)
  - OpenAI: embeddings only (no chat model registered)
  - OpenRouter: chat models only (no embeddings)

  They're not interchangeable providers of the same contract — they're orthogonal capability providers.

### 2. **LLM modules are doing two unrelated jobs (the "two paths" you noticed)**

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

This is **chat models only**, no embeddings, no storage.

So the LLM modules are inconsistent in what they provide — they're not really "LLM provider modules" in a uniform sense.

### 3. **Storage modules are incomplete (missing the "core" half)**

The storage modules (`storage-pgvector`, `storage-qdrant`) are **store implementations only** — they export `createPgVectorStore()` / `createQdrantVectorStore()` factory functions, but:

- No extension point to register a store
- No config-driven resolution of which store to use
- No tool factory that exposes store operations as `ToolDefinition`s

They're missing the "core extension plugin" layer that would make them match the VCS pattern.

## The architectural inconsistency you spotted

You've identified that the repo has **two patterns coexisting**:

| Pattern                               | Used by            | Structure                                                    |
| :------------------------------------ | :----------------- | :----------------------------------------------------------- |
| **Core extension + provider drivers** | VCS, Observability | `module-vcs` (registry + tools) ← `module-vcs-github` (driver only) |
| **Self-contained capability modules** | LLM, Storage       | `module-llm-aws` (does everything itself), `module-storage-pgvector` (store factory only) |

The LLM/storage pattern emerged because:

- The **fork-era code** (Larder's original RAG plugin) bundled embeddings + storage + retrieval as a single "augmenter" concept
- Chat models were added later via `modelExtensionPoint` (a core extension point, not a module pattern)
- Nobody refactored the embeddings/storage path to match the driver-registry pattern

## Your multi-modal realization — why this matters now

Your insight about transcription, vision, reranking, classification, and guardrail models is **spot-on** and exposes exactly why the current structure will break down:

| Model type     | LangChain interface          | Example use case                                |
| :------------- | :--------------------------- | :---------------------------------------------- |
| Chat models    | `BaseChatModel`              | Current: GPT-4o, Claude 3.5 Sonnet              |
| Embeddings     | `Embeddings`                 | Current: Bedrock Titan, OpenAI text-embedding-3 |
| Transcription  | `AudioLoader` / custom       | Whisper API for voice notes                     |
| Vision         | `BaseChatModel` (multimodal) | GPT-4o parsing Grafana screenshots              |
| Reranking      | `Reranker`                   | Cohere Rerank for retrieval pipeline            |
| Classification | Custom / `BaseChatModel`     | Severity tagging (P1/P2/P3)                     |
| Guardrails     | Custom classifier            | Llama Guard for prompt safety                   |

Right now, `ModelDefinition.model` is typed as `BaseLLM | BaseChatModel` — that covers **one row** in this table. The rest have no home.

## What the correct structure looks like (answering your Q1 implicitly)

You need **capability-category modules** (like VCS) for each model type:

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

plugin-ai-core-backend-module-storage-pgvector
  → registers: PgVectorStore into vectorStoreExtensionPoint

plugin-ai-core-backend-module-storage-qdrant
  → registers: QdrantVectorStore into vectorStoreExtensionPoint
```

The **retrieval-augmenter** then composes: active embedder + active vector store → indexer/retriever (instead of LLM modules hard-coding `createPgVectorStore`).

## Bottom line

The LLM/storage groups don't have core extension plugins because they grew from the fork-era RAG plugin as monolithic "augmenter" bundles, before the driver-registry pattern was established. Your multi-modal insight is the forcing function to fix it: the current `BaseLLM | BaseChatModel` typing and the lack of extension points for embeddings / transcription / reranking / classification / guardrails means those capabilities have no place to register. The VCS / observability pattern is the proven template — you just need to apply it to each model capability category.

This is a significant architectural insight. Want me to add a "Model Capability Categories" section to `_CORE_REFACTOR.md` that:

1. Breaks `ModelDefinition` into per-category types (`ChatModelDefinition`, `EmbeddingsDefinition`, `TranscriptionDefinition`, etc.)
2. Adds extension points per category
3. Splits current `llm-*` modules into pure provider registrations
4. Creates `storage-vector` core extension module
5. Updates retrieval-augmenter to compose from extension points instead of hard-coding `createPgVectorStore`

This would unify the entire module architecture under the VCS/observability pattern.

## 1. Guardrails

The enforcement point is the engine itself: `ModelExecutor` runs input classification **before** dispatching to the chat model and output classification **on the streamed response** before tokens reach the SSE channel — configurable per agent (`ai.agents.<id>.guardrails: { input: true, output: true }`). An `unsafe` verdict becomes an `error` event with `code: 'guardrail_blocked'` (a new `ErrorCode`), never a leaked response. This composes with the redaction policy (redaction = *sanitize and proceed*; guardrails = *classify and halt*) and with the audit log (every block is audited). That's the enterprise content-safety story the compliance audit's Section H gestures at but doesn't specify.

## 2. The model-tier abstraction — concrete shape

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

**Want me to fold these into the canonical plan:**

(1) model tiers: the config indirection that lets an agent name `fast`/`reasoning` instead of a concrete `modelRef`, so operators can retune spend in one place. Tiers sit *on top of* the chat category; they don't depend on the capability-category restructuring (you could ship tiers against today's `modelExtensionPoint` alone).

(2) __"Capability-category pattern"__ refers to the __module architecture__ discussion — the thing your VCS question (Q1) surfaced. It's the structural pattern that VCS and observability follow but LLM/storage don't:

- A __core extension module__ per category (`module-vcs`) that owns the driver registry, the extension point, config-driven resolution, and the tool factory.
- __Pure provider modules__ (`module-vcs-github`) that only register a driver — no core changes needed to add a provider.
- Plus the supporting discipline we discussed: the five-artifact anatomy (driver contract → extension point → tool factory → module → external driver), `defineDriverContractTests`, the scaffolding generator, and the review checklist for "what requires a core PR."

Applied to models/storage, that pattern is what produces the proposed new modules: `module-models-chat`, `module-models-embeddings`, `module-models-transcription`, `module-models-reranking`, `module-models-guardrail`, `module-storage-vector` — with the existing `llm-*` / `storage-*` packages becoming pure provider registrations against them, and retrieval-augmenter composing embedder + store from extension points instead of hard-coding `createPgVectorStore`.

## Multi-Provider Routing

**Verified current behavior**: multiple registrations are *accepted* but only one is *used*. Both `module-vcs` and `module-compliance` keep a `Map<providerId, driver>` (so `registerDriver` can be called N times), but at init they read a single provider key from config and resolve exactly one:

```ts
// module-vcs/src/config.ts + module.ts
const provider = vcsConfig.getOptionalString('provider');   // one string
const driver = drivers.get(vcsConfig.provider);             // one driver
```

Then `createVcsTools({ driver })` builds tools bound to that single driver. So no — tools do **not** fan out to all providers; `vcs.repository.get_metadata` fires against the one configured driver. If GitHub *and* GitLab modules are both loaded, the GitLab driver is registered but inert. (Note the irony: `config.ts` validates the provider against `SUPPORTED_PROVIDERS` — a hardcoded list — which is the closed-union friction we discussed, now also blocking multi-provider.)

**What multi-provider should look like** — and VCS is actually the *easiest* category to get right, because routing information is already in the request:

Every VCS tool input carries `repoUrl`, and repo URLs contain the host (`github.com/...` vs `gitlab.acme.internal/...`). So the natural routing rule is **host-based dispatch**:

```ts
// module-vcs resolves per call, not once at boot:
createVcsTools({ drivers, logger })  // the whole Map, not one driver
// tool invoke():
const host = new URL(args.repoUrl).host;
const driver = driverForHost(drivers, host, config);  // host → providerId map
```

- `driverForHost` uses each driver's declared hosts (GitHub driver declares `github.com` + configured GHE hosts; the existing Backstage `ScmIntegrations.fromConfig(config)` already knows host→type mappings — the github module already consumes it for credentials, so the data source exists).
- Config gains `ai.integrations.vcs.providers: { github: {...}, gitlab: {...} }` (a map, not a single key) plus an explicit `hostMappings` table for self-hosted instances.
- Ambiguity (a repo URL no driver claims) → a typed limitation, not a silent default — the stub-driver honesty rule.

This generalizes per category, using the routing data each category naturally has:

| Category  | Routing signal | Fallback |
| :--- | :--- | :--- |
| VCS | `repoUrl` host | config default → limitation |
| Communication | `providerId` arg (the field we discussed) → channel's provider | agent `providers` policy → config default |
| Observability | `providerId` arg or per-query config | config default |
| LLM chat/embeddings | `modelRef` (already per-model!) | agent's `modelRef` |

Note the last row: **the model registry is already multi-provider.** `models.addModel` registers many models keyed by ID, and each agent picks via `modelRef`. OpenRouter's module already loops `for (const model of createOpenRouterModels(...)) models.addModel(model)`. So "multiple providers at once" already works for models — it's the *driver* categories that are single-provider-only. That asymmetry is exactly what host/arg-based routing fixes.

For the refactor, this means: core extension modules take the full driver `Map` into their tool factories instead of resolving one driver at boot; config schemas change `provider: string` → `providers: map + hostMappings`; and the `providerId?` input field + agent `providers` policy from our earlier discussion become the cross-category routing/restriction contract.

> I'm working on a monorepo of agentic workflow plugins for Spotify Backstage. There are 18 total workflow plugins. We have a backend core and node plugin that handles stitching the running app together.
>
> We also have a group of extension plugins that provide a unified interface for categories of third-party services. These include cloud-providers (like AWS), communication (like Slack), compliance (like OPA), incident-management (like PagerDuty), observability (like DataDog), project-management (like Jira), quality-scorecards (like Soundcheck), and vcs (like GitHub). Each of these groups has a root plugin that registers with the backend core plugins, and individual provider plugins that register with the extension root plugin in an array.
>
> Right now, the system has no way for agentic workflow plugins to act on the groups of extension plugins with particularity. Multiple extension provider plugins can register with the extension root and are kept in an array; however, only the first is called when an agentic workflow plugin makes a tool call like `vcs.repository.search`.
>
> We're trying to work out how to improve this system. One suggestion on the table is using host-based dispatch. For example, every VCS tool input carries `repoUrl`, and repo URLs contain the host (`github.com/...` vs `gitlab.acme.internal/...`). So extension provider selection would be based on the host.
>
> This design doesn't feel right, but I'm not sure how to get the design of this system right. Some workflows would by default want to run against every provider registered. Some workflows might want different selections of platforms in a single extension category within a given run - for example, based on the prompt an engineer gives the LLM. I'm not sure exactly how we'd update our system to permit that - we're using LangGraph, we do have a human-in-the-loop event that pauses for user approval.
>
> But we've been strict so far about not allowing the LLM to generate tool selection for subsequent steps given the safety and security implications. But choosing what providers in an extension group a tool is applied to feels different - although I'm worried I'm not seeing the issue clearly and making a security/safety mistake considering this. It could also be that the extension platforms vary based on other criteria - the group an engineer belongs to, user choices in the frontend UI, etc.
>
> I'm really lost and could use help sorting out what the issues are and what an answer might be. Can I give you descriptions of the 18 agentic workflow plugins that we have, so you have a clear idea of how this applies?

### Gemini's response:

That sounds like a classic, high-stakes architecture problem where a simple routing abstraction is colliding with the real-world complexity of multi-provider setups. You are right to hesitate: **treating provider routing purely as static data dispatch (like host-based routing) breaks down when selection depends on the runtime context, user identity, or LLM intent.**

#### Why host-based dispatch feels wrong

- **Context Blindness:** A host URL tells you *where* code lives, but it doesn't tell you *who* is asking, *which* environment they are targeting (prod vs. dev Slack channels), or *what* budget/compliance constraints apply.
- **The "Broadcast" vs. "Targeted" Dilemma:** As you noted, some tools need to fan-out to *all* providers (e.g., searching for an incident across PagerDuty and Opsgenie), while some must target exactly one (e.g., cutting a Jira ticket). A single static table cannot easily support both.

#### The Security Angle: LLM Tool Selection vs. Provider Selection

Your intuition is spot on: **there is a massive difference between letting an LLM choose \*what action\* to take vs. \*where\* that action is executed.**

- Letting an LLM decide to call `vcs.repository.delete` is a **tool selection risk** (high danger).
- Passing a contextual boundary (like `allowed_providers: ['github-internal']`) into a strict, pre-selected tool is a **scoping mechanism** (safer, standard RBAC practice).

#### Three distinct "routing lenses"

- **Implicit / Environmental Routing:** Determined automatically behind the scenes by Backstage (e.g., the current user's entity relations, their Backstage token, or their software catalog ownership).
- **Explicit / Parameterized Routing:** The agent determines the target based on the user's prompt (e.g., "Post this to the #ops Slack channel"), but the *execution engine* validates this against an absolute permit list before firing.
- **Fan-Out / Scatter-Gather Routing:** The tool executing against *all* registered providers simultaneously and aggregating the results for the LLM.

By anchoring your architecture to **Backstage's greatest strength—the Software Catalog**—and leveraging a **three-layered runtime context**, you can build a secure, elegant, and highly adaptable dispatch system.

#### The Architecture: Three Routing Paradigms

Instead of forcing every extension category to route the same way, your backend core plugin should evaluate tools using three distinct dispatch mechanisms:

##### Entity-Bound Context (Implicit / Environmental Routing)

Many of your plugins (**Catalog AI Insights**, **Kubernetes AI Responder**, **Techdocs AI Janitor**, **Tech Debt AI Scout**) operate directly on a specific Backstage entity (like a `Component`).

- **How it works:** When the agent initializes, the backend core fetches the full Catalog Entity YAML. It extracts the annotations (e.g., `://github.com`, `://pagerduty.com`, `://datadog.com`).
- **The Routing Decision:** The core injects these explicit target IDs directly into the tool's runtime context. The agent doesn't guess where to look; the software catalog acts as the single source of truth for scope.

##### Scatter-Gather (Fan-Out & Aggregate)

Plugins like **Search AI Archeology**, **Search AI Context**, and **Tech Radar AI Manager** are discovery agents. They don't have a single target.

- **How it works:** The core router intercepts the tool call (e.g., `communication.search`) and concurrently broadcasts it to *every* registered provider plugin in that array.
- **The Routing Decision:** The provider plugins return their individual results, and the core router merges them into a unified payload before handing it back to the LangGraph node. The LLM has zero awareness that 4 different systems were queried.

##### Agent-Driven Parametric Intent (Validated Scoping)

For your generative and automation plugins (**Scaffolder AI Intent**, **Release Notes AI Generator**, **Techdocs AI Postmortem**), the target depends entirely on user intent or a trigger payload (e.g., an AlertManager webhook).

- **How it works:** The LLM extracts entities from the prompt (e.g., "Draft a postmortem based on the #incident-outage-0824 Slack channel").
- **The Routing Decision:** The LLM invokes the tool with arguments like `channel: "#incident-outage-0824"`. The core router receives this and iterates through the registered provider plugins asking: *"Which of you manages a channel with this identifier?"* The provider validates it internally and claims the execution.

#### The Matrix: How the 18 Plugins Map to Routing & Security**

| Plugin Name | Primary Routing Signal | Dispatch Mechanism | Security Risk Level | Human-in-the-Loop Requirement |
| --- | --- | --- | --- | --- |
| **Alert AI Tuner** | Incoming Alert Payload | Target specific Infra VCS via Catalog Owner | **High** (Writes Code) | **Mandatory** (PR Review / Approval) |
| **Catalog AI Insights** | Current Active Catalog Entity | Entity-Bound Context (Annotations) | Low (Read-only) | None |
| **Kubernetes AI Responder** | Webhook Metadata / Component | Entity-Bound Context + Observability lookup | Medium (Live Infra Reads) | None (Investigation Phase) |
| **Oncall AI Handover Assistant** | Time range + Team Context | Scatter-Gather (Incidents + Comm Providers) | Low (Read-only Summary) | None |
| **Release Notes AI Generator** | Branch Diff / Trigger Payload | Explicit (Cross-references VCS slug to Jira Project) | Low (Read-only Reads) | None |
| **RFC ADR AI Reviewer** | Input Document Location | Entity-Bound + Scatter-Gather (API Schemas) | Low (Read-only Audit) | None |
| **Scaffolder AI Drift Detector** | Catalog Ancestry / Tech Radar | Scatter-Gather (Scans all code matching templates) | Low (Read-only Audit) | None |
| **Scaffolder AI Guardrail Agent** | Input Parameters / Budget Policies | Scatter-Gather (Queries all compliance systems) | Medium (Blocker Tool) | None (Automated Policy) |
| **Scaffolder AI Infra** | Selected Template Blueprint | Explicit (Targets specific IaC module repos) | **High** (Generates Code) | **Mandatory** (User reviews generated IaC)  |
| **Scaffolder AI Intent** | Natural Language Prompt | Explicit (Resolves prompt to a Catalog Template ID) | Medium (Triggers action) | **Mandatory** (Confirms template selection) |
| **Scaffolder AI PRD** | Input Document Payload | Explicit (Maps project info to Jira/Linear API) | Medium (Writes Tasks) | **Mandatory** (Review generated tickets) |
| **Scaffolder AI Shadow Detective** | Cloud Provider APIs vs Catalog     | Scatter-Gather (Queries all cloud providers at once) | Low (Read-only Audit) | None |
| **Search AI Archeology** | Search Query String                | Scatter-Gather (Queries all ticket & wiki providers) | Low (Read-only) | None |
| **Search AI Context** | Search Query String | Scatter-Gather (Queries all documentation providers) | Low (Read-only) | None |
| **Tech Debt AI Scout** | Entire Catalog / Global Scope      | Scatter-Gather (Loops over all registered codebases)    | Low (Read-only Audit) | None |
| **Techdocs AI Janitor** | Storage Buckets + Catalog Owners   | Entity-Bound Context + Global Storage Buckets | **High** (Creates PRs)    | **Mandatory** (PR Review / Approval) |
| **Techdocs AI Postmortem** | Trigger Incident ID / Timeline     | Explicit Parameter (User specifies Slack/PagerDuty IDs) | Low (Drafting text) | None (Draft output) |
| **Tech Radar AI Manager** | Telemetry / Lifecycle signals      | Scatter-Gather (Aggregates usage across all VCS/Logs) | Low (Drafts Suggestion) | **Mandatory** (Radar admin approval) |

#### Solving Your Security Concerns

You noted a concern about safety regarding tool selection. Your instinct to separate **what action to take** from **where that action happens** is exactly how you solve this cleanly in code.

By implementing Backstage’s modern permissions model in the core router, you can wrap the tools in an execution sandbox.

```bash
[ User Prompt / Action ]
         │
         ▼
 ┌───────────────┐
 │ LangGraph LLM │ ──(Wants to invoke vcs.repository.create)
 └───────────────┘
         │
         ▼
 ┌────────────────────────────────────────────────────────┐
 │            Backend Core Plugin Router                  │
 ├────────────────────────────────────────────────────────┤
 │ 1. Backstage Permissions Check:                        │
 │    Does User X have 'scaffolder.template.write'?       │
 │                                                        │
 │ 2. Dynamic Scoping (The Guardrail):                    │
 │    Filter provider array based on RBAC. Only inject    │
 │    ['github-internal'] into execution context.         │
 └────────────────────────────────────────────────────────┘
         │
         ▼
 ┌───────────────────────────┐
 │ Extension Root Plugin     │ ──(Executes safely ONLY on allowed providers)
 └───────────────────────────┘
```

#### The Implementation Blueprint

Instead of letting the LLM choose the provider, let the **Core Router filter the array of executable providers** before invoking the tool block. Your provider definitions can expose a `canHandle` or `scoping` method:

```typescript
// Example Interface for your Extension Provider Plugins
interface ExtensionProvider<TInput, TOutput> {
  id: string; // e.g., 'github-internal', 'gitlab-acme'
  
  // Core uses this to see if this provider should be invoked for a given run context
  shouldExecute(context: BackstageRunContext, toolArgs: TInput): Promise<boolean>;
  
  execute(toolArgs: TInput): Promise<TOutput>;
}
```

When an agent invokes a tool, the Core Router loops through the extension array, drops any provider that fails authorization or context relevance, and handles either a **Scatter-Gather** (executing all remaining) or an **Explicit** match (executing the single true match).

### Kimi-K3's Assessment with Access to Context

## What's genuinely good

__1. The routing-strategy taxonomy is the best idea in the section.__ Explicit / Scatter-Gather / Entity-Bound classified per plugin (lines 380–414) is a real insight. It converts "multi-provider" from a vague ambition into a per-category routing contract — and it correctly identifies that some workflows *want* fan-out (shadow-detective querying all cloud providers, archeology querying all ticket sources) while others need exactly one resolved target. That framing is better than my original answer and should survive into the canonical plan.

__2. RBAC-filtered provider scoping (the flow diagram) is the right security shape.__ "Filter the provider array by permissions *before* dispatching" is correct: the model/nodes see "the providers you're allowed to touch," not "everything minus a runtime error." That's the right side of the clarity-vs-safety tradeoff for agents, and it composes well with the agent-level `providers` policy we discussed (policy narrows the set, RBAC narrows it further per caller, routing picks within).

__3. The scatter-gather risk/approval annotations per plugin__ are a solid audit artifact — e.g. flagging techdocs-janitor as "High (creates PRs) → Mandatory approval" while classifying shadow-detective fan-out as "Low (read-only) → None." That per-plugin matrix is useful for sequencing.

## What needs pushback — three structural concerns

__1. The interface sketch inverts the driver boundary.__ `ExtensionProvider<TInput, TOutput> { shouldExecute(context, args); execute(args) }` (lines 452–462) makes providers *generic executors*. That breaks the discipline of the capability-category pattern: VCS drivers are typed contracts (`VcsDriver` with `getMetadata`, `readFile`, `searchRepository`, `listPullRequests`), not `execute(args)` — the tool IDs exist so allow-lists and audit mean something. A generic `execute` collapses tool identity and loses the effect/read-write metadata that powers approval gating. The correct shape is: __keep typed driver contracts; add routing metadata *alongside* them.__ A driver declares its routing capability (`shouldHandle` for host matching, or declared hosts at construction), and the *category module* (not the core router) evaluates it. The sketch also puts routing logic in "Core Router" — routing per category belongs in the category module's tool factory; the core backend router shouldn't know that VCS routes on hosts while communication routes on channel provider. Push routing down into each category, keep `ToolExecutor` as the policy/RBAC filter, and the interface should read more like:

```ts
interface CategorizedDriver {
  readonly providerId: string;
  /** Declares whether this driver can serve this tool input. Pure/host-match only. */
  canHandle?(args: unknown): boolean;
}
// category tool factory filters Map drivers by canHandle + RBAC visibility,
// then dispatches single-match or fans out per the category's routing strategy.
```

__2. Scatter-Gather needs result semantics, not just fan-out.__ "executing all remaining" is underspecified for tools. Shadow-detective fanning out over cloud providers works because the workflow aggregates results *as a defined collection node* — the engine needs a fan-out/list-returning invocation mode (`ToolExecutor.invokeAll` returning per-provider outcomes including per-provider failures, rather than one aggregate throw). Otherwise scatter-gather breaks the single-result `ToolInvocationResult` shape and makes failures ambiguous (does one bad provider fail the audit?). The plugin table should be annotated with the *aggregation* semantics too, and archeology's "all ticket providers" fan-out should specify timeout/budget per provider. Without that, scatter-gather is a footgun the taxonomy invites.

__3. `ai.providers.global.routing` needs to reject scatter-gather.__ Line 322's fallback column ends `agent providers policy →` (still truncated), but across the section the fallback chain is per-category — there's no safe global default. I'd explicitly exclude scatter-gather from any global routing config and restrict it to categories where the workflow explicitly opts in (like cloud-providers for shadow-detective). Otherwise operators can configure a dangerous "query everything" posture for write-capable categories.

## Minor notes

- "BackstageRunContext" in the interface example should be the `NodeExecutionContext`-adjacent run metadata (runId, agentId, identity) — name it against plan types rather than "Backstage."
- The flow diagram's step 1 ("Backstage Permissions Check on the tool") aligns with the audit's E.2/E.3 adoption items — good cross-consistency; just make sure the permission evaluation happens in `ToolExecutor`, not "the core HTTP router" as the diagram's box says. Routing boxes should be engine, not HTTP.
- The truncated fallback cell in my earlier table got copied in; the completed chain is `arg providerId → agent providers policy → config default` — one of those may need updating to include RBAC-filter as a final step.

## Verdict

Keep the routing-strategy taxonomy and the RBAC-filtering flow — both are upgrades to what I gave you. Rework the interface sketch so drivers stay typed contracts and routing lives in category modules, and specify scatter-gather aggregation semantics before letting plugins opt into it. With those two changes, the section is plan-worthy and should be folded into the canonical refactor as the "Multi-Provider Routing" section, replacing my earlier text.

Want me to do the merge into `_CORE_REFACTOR.md` with those corrections applied — routing taxonomy preserved, interface fixed to typed drivers with `canHandle`, `invokeAll` scatter-gather mode added to `ToolExecutor`, and scatter-gather blocked in global config?

# Agent Question and Answer on Refactoring Plans

## Agent Responses

---

## Question 1 — The `usage` event: where it lives, current use, and a monitoring plugin

__Where is it located?__

Today there is __no dedicated Postgres usage table__. The `usage` event is persisted only as an unstructured row in the run-step event log:

- `AgentRuntime.processRunEvent` → `recordUsage()` (`AgentRuntime.ts:505`) does two things with a `usage` event:

  1. Sets OpenTelemetry span attributes on the run span (`ai.usage.input` / `ai.usage.output` / `ai.usage.total`) — line 512-514.
  2. Accumulates `state.totalUsage` in-memory to enforce the `maxTotalTokens` budget.

- The event itself is written to the durable store via `appendEvent` → `ctx.runStore?.appendRunStep(runId, seq, 'usage', redact(event.data))` (line 387). So it lands as one JSON payload among all other step events in whatever `RunStore` is registered (the SQL-backed one in `plugin-ai-core-backend-module-runtime-store` — `SqlAgentRuntimeStore.ts` with a migrations file, so yes it can be Postgres, but usage is __not__ broken out into its own columns or table).

__Is it currently used?__

Barely, and not for what you describe:

- __Budget enforcement__: yes, in-memory per run (`maxTotalTokens`).
- __OTel telemetry__: yes, span attributes (queryable if you export traces to a backend like Tempo/Jaeger/Honeycomb).
- __Org-wide spend/token/efficiency tracking across runs__: __no.__ Nothing aggregates usage across runs, agents, models, or time. There is no usage table, no cost model, no per-model pricing, no reporting surface. The data exists only as scattered JSON blobs in the run-step log plus trace attributes. There is also no cost computation — the event records token *counts*, not dollars (the `cost.estimate` tool in `ToolPacks.ts` is an unrelated echo placeholder).

__Does a dedicated monitoring plugin make sense?__

Yes — and it fits the roadmap naturally rather than being new scope. This is essentially the "Dashboards/alerts for failed runs, degraded-source rate, scan duration, and __model cost__" item that already appears in the catalog-ai-insights Milestone 4, generalized. My recommendation:

- __Right move for the refactor__: add a first-class, __structured `usage` table__ (or a `UsageSink` contract) in the runtime-store module rather than leaving usage as unstructured step JSON. Columns: `runId`, `agentId`, `workflowRef`, `node?`, `modelRef`, `input`, `output`, `total`, `createdAt`. The per-node `usage` events (with the now-required `node` field from your `AgentEvent` v2) make this trivially queryable. This is a small, high-value addition to §4.4 — the current plan persists usage but doesn't give it a queryable shape.
- __A dedicated plugin__ (say `plugin-ai-observability` / a cost-insights frontend) then reads that table and renders spend by model / agent / node / team over time, prompt-efficiency ratios (tokens per artifact produced), and budget-burn alerts. It becomes a consumer of clean data instead of a log scraper.
- One caveat: token counts are only half of "spend." Real cost needs a __pricing map__ (`modelRef -> $/1K input/output tokens`) in config, applied either at write time (denormalize a `costUsd` column) or at query time. I'd put the pricing map in config and compute at query time so you can reprice history when provider pricing changes.

If you want, I'll add a short subsection to the plan: a `UsageSink` contract + `usage_records` table + a config-driven pricing map, explicitly flagged as the foundation for a future cost-monitoring plugin.

## Question 2 — Is there config to add/remove sensitive-key regexes?

__No.__ Today the redaction list is a __hardcoded constant__, not configurable:

- `AgentRuntime.ts:46`:

  ```ts
  export const SENSITIVE_KEYS = [
    'authorization', 'token', 'apikey', 'api_key',
    'secret', 'password', 'cookie',
  ];
  ```

- The `redact()` function (line 59) is a pure function over that fixed array. It matches by *key name substring* (`key.toLowerCase().includes(s)`), not by regex.

- I checked `config.d.ts` for the core plugin and the runtime-store module's `config.ts` — __neither exposes any `sensitiveKeys` / `redaction` / `secrets` config.__ There is no user-facing way to add or remove patterns.

__Two implications for the refactor:__

1. __The current mechanism is key-name substring matching, not regex on values.__ That catches `password: "..."` but misses a secret sitting in a *value* under an innocuous key (e.g. `notes: "ghp_abc123..."`). The plan's promise of "reject checkpoint payloads containing credential-shaped strings (regex sweep as defense-in-depth)" is a *stronger* mechanism than what exists — it implies __value-pattern scanning__ (e.g. GitHub token format, AWS key format), which the current code does not do at all.

2. __Configurability is a genuine gap worth closing in the plan.__ For an enterprise audience, a hardcoded list is a liability — different orgs have different secret shapes (internal token prefixes, custom header names). I'd add to the plan:

   - A `RedactionPolicy` contract in core-node: `keyPatterns: RegExp[]` (key-name matching, superset of today's behavior) + `valuePatterns: RegExp[]` (credential-shape scanning) + `mode: 'redact' | 'reject'`.
   - Config surface `ai.redaction.*` with sensible secure defaults (today's keys + common token formats), allowing operators to *append* patterns but __not remove the built-in floor__ (a safe default you can widen but not weaken) — important for a security posture claim.
   - The harness applies this policy at state-patch, event, and checkpoint boundaries, as §5.2 already states.

Want me to fold both of these — the `UsageSink`/usage-table/pricing-map item and the configurable `RedactionPolicy` — into `_CORE_REFACTOR.md` as new subsections (§4.4 usage persistence, §5.2 redaction policy)? They're both small, they belong in the plan, and they directly answer the "enterprise-grade" bar you set.

## 4. Extensibility — mostly yes, with two seams to watch

**Verified architecture**: modules self-register through extension points, and core never switches on provider identity at runtime. The VCS module pattern is representative: it exposes `vcsDriversExtensionPoint.registerDriver(driver)`; when a driver registers, the module itself calls `createVcsTools({ driver, logger })` and pushes tools through `toolExtensionPoint.addTool()` (`module.ts:38-68`). The Datadog observability module is a sibling example — `plugin-ai-core-backend-module-observability` defines the driver contract + tools, and `-datadog` is a pure plugin providing a driver with zero core involvement.

In the example of an external team adding a new Grafana driver: an external developer publishes a package that calls `observabilityDriversExtensionPoint.registerDriver(new GrafanaDriver(config))`, and the existing module generates and registers the `observability.*` tools. **No core PR, no patched core.** Their module reads its own config namespace (e.g. `ai.observability.grafana.*`) via `coreServices.rootConfig` — core never sees provider-specific config either.

Two seams where core changes *would* be needed today:

### **Provider ID unions in core-node types** 

`VcsProviderId = 'github' | 'gitlab' | 'bitbucket' | 'azuredevops'` is a closed union in `@types/vcs.ts`. A third-party VCS provider can't assign a new ID without a type error. Fix (cheap, do it in this refactor): widen these to `string` with a branded/validated pattern, or `string & {}` to preserve autocomplete for known IDs. The driver registry already treats IDs as map keys — the union is pure friction.

### **Entirely new capability categories**

If someone invents a category with no driver contract (say, a feature-flag platform), they'd need a new driver interface + extension point, which lives in core-node. That's the right boundary — the contract is the product — but you should design for it: a generic "define your own extension point" escape hatch isn't needed; what's needed is discipline that contracts in core-node are the *only* thing requiring core PRs, and driver implementations never do.

Here's what implementing it concretely looks like, with the feature-flag platform as the worked example.

#### The pattern, made mechanical

There are exactly five artifacts per capability category. Three live in core-node (the contract), one is the module, one is the driver. The discipline is: __core-node changes are contract additions only — never modified when a new provider arrives.__

##### 1. The driver contract — core-node, `@types/<category>.ts`

The only thing that requires a core PR, ever. Written once per *category*, not per provider:

```ts
// plugin-ai-core-node/src/@types/featureFlags.ts
export type FeatureFlagDriver = {
  /**
   * Provider identity, e.g. 'launchdarkly', 'flagsmith',
   * 'unleash'. Open string.
   */
  readonly providerId: string;
  listFlags(input: ListFlagsInput):
      Promise<FeatureFlagSummary[]>;
  getFlag(input: GetFlagInput):
      Promise<FeatureFlagDetail | undefined>;
  // ...read ops first; write ops (createFlag, toggleFlag)
  // are a deliberate, separately-reviewed addition since
  // they carry effect: 'write' implications
};
```

Three rules that make this "the contract is the product":

- __`providerId: string`, never a union.__ This is the `VcsProviderId` fix generalized — the contract can never enumerate providers, so it must not try.
- __Input/output types are provider-neutral__ and use the shared primitives (`ServiceActor`, `TimeRange`, `EntityFilterShape`) so agents can write workflows against the category without knowing the provider.
- __The contract is small and honest.__ Only ops every provider can honor. Provider-specific capabilities surface as `limitations` in results, not as optional contract methods (that's the stub-driver lesson from VCS search).

##### 2. The extension point — core-node, `extensions.ts`

Identical shape to the seven that already exist. This is the mechanical part:

```ts
export interface FeatureFlagDriversExtensionPoint {
  registerDriver(driver: FeatureFlagDriver): void;
}
export const featureFlagDriversExtensionPoint =
  createExtensionPoint<FeatureFlagDriversExtensionPoint>({
    id: 'ai-core.feature-flag-drivers',
  });
```

##### 3. The tool factory — the *capability module*, not core

`plugin-ai-core-backend-module-feature-flags` (new module, lives in *your* repo or the provider author's — either way, __not__ in core). It owns translating any registered driver into the uniform tool surface:

```ts
// createFeatureFlagTools({ driver, logger }): ToolDefinition[]
//   -> feature_flags.flag.list   (effect: 'read')
//   -> feature_flags.flag.get    (effect: 'read')
```

Key design point, proven by the VCS module: the module registers tools __per driver__ but under __provider-independent tool IDs__ (`feature_flags.flag.list`, not `launchdarkly.list_flags`). Driver selection happens inside the tool via config (`ai.featureFlags.provider: grafana-cloud` etc.) or per-call args — so an agent's `toolIds` allow-list is stable across providers.

##### 4. The driver — fully external

A third party ships `@acme/backstage-plugin-ai-feature-flags-grafana`:

```ts
export const grafanaFeatureFlagModule = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'feature-flags-grafana',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        drivers: featureFlagDriversExtensionPoint,
      },
      async init({ config, drivers }) {
        drivers.registerDriver(
          new GrafanaCloudFeatureFlagDriver(readGrafanaConfig(config)),
        );
      },
    });
  },
});
```

They own their package, their config schema (`config.d.ts` in *their* package, namespaced under `ai.featureFlags.grafana.*`), their release cadence. Zero lines changed in your repo. This is exactly the Datadog pattern already in the repo (`module-observability` owns the contract + tools; `module-observability-datadog` is a pure external driver) — the discipline is just making that the *stated, tested* rule for every category.

#### The enforcement layer — what "discipline" means in code

A pattern you can copy is only half of it. Three concrete mechanisms make the boundary hold under pressure:

1. __A contract-test scaffold in core-node `test-utils`.__ `defineDriverContractTests<FDriver>({ makeDriver, category })` — a reusable Vitest suite every capability module must run against a fixture driver: all read ops return contract-shaped results, absent capability degrades to a typed limitation (never throws, never returns `[]` silently — the VCS stub-driver failure mode), `providerId` is a non-empty string, no provider-specific types leak into contract I/O. When a module author adds a category, the test suite *is* the documentation of the safety invariants.

2. __A scaffolding generator.__ A `scripts/` or backstage-cli template: `yarn new:capability feature-flags` generates the three core-node artifacts + the module skeleton + the contract-test wiring. The cost of "doing it right" drops below the cost of doing it ad hoc — which is the actual mechanism that prevents the original 18-plugin mistake from recurring in module-land.

3. __A review checklist encoded in the plan/repo docs__ for what qualifies as a core-node contract change:

   - New category? → new contract + extension point + (usually) a capability module. Core PR justified.
   - New provider for existing category? → driver only. __Core PR is a defect__ — if one is needed, the contract is under-generalized and *that* is the bug to fix.
   - New read op on existing category? → contract addition, additive, non-breaking. Reviewable.
   - New write op? → contract addition *plus* `effect: 'write'` tooling plus approval-policy verification. Highest scrutiny tier.

#### What this does *not* include (deliberately)

- __No generic "register anything" escape hatch__ (e.g. `addTool` is already generic, and that's fine — but there's no "define your own extension point at runtime" API). Arbitrary dynamism would dissolve the audit/allow-list/effect-gating guarantees the refactor builds. If a capability can't be expressed as a typed driver behind a typed extension point, that's a signal the capability needs design, not a loophole.
- __No config-driven tool generation__ (tools from YAML/JSON schemas). Tempting, but it pushes type safety out of the compiler and into config validation — a net loss for a portfolio claiming enterprise rigor.

#### **Add Custom Monorepo Code Templates to `backstage-cli`**

To allow internal developers working on your monorepo to run a command like `yarn new` and select a custom option (e.g., `extension-category-plugin`), you extend the CLI using **Custom CLI Modules**.

Step 1: Scaffold a CLI Module

Run the default Backstage generator to create a CLI configuration footprint:

```bash
yarn newSelect **`cli-module`** from the interactive menu. This outputs a package using the `@backstage/cli-node` library.
```

Step 2: Define the Custom Command & Boilerplate Files

Inside your new CLI module package, register a command block using the `createCliModule` API. You populate a target directory by feeding user prompts (via an interactive inquirer library) into template source files containing template properties (e.g., `package.json.hbs`, `src/plugin.ts.hbs`).

```typescript
// plugins/mymonorepo-cli/src/commands/createExtensionCategoryPlugin.ts
import { createCliModule } from '@backstage/cli-node';
import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';

export const createAgentPluginCommand = createCliModule({
  register(cli) {
    cli
      .command('new-extension-category-plugin')
      .description('Generates an internal extension category plugin template.')
      .action(async () => {
        // 1. Add interactive prompt logic using an inquirer loop
        const pluginId = '<your-extension-category>'; // from prompt

        // 2. Resolve template target directories
        const templateDir = path.resolve(__dirname, '../../templates/agent-plugin');
        const targetDir = path.resolve(process.cwd(), `plugins/agentic-${pluginId}`);

        // 3. Write dynamic boilerplate generator logic
        await fs.ensureDir(targetDir);
        // Map templates, replacing strings like {{pluginId}} or structural code contracts
        logger.info(`Successfully generated custom extension category skeleton in ${targetDir}`);
      });
  },
});
```

Once this is listed as a development dependency in your monorepo's root `package.json`, running `yarn backstage-cli new-extension-category-plugin` automatically provisions your custom file structures.

#### Where this lands in the plan

I'd add it to `_CORE_REFACTOR.md` as a new section between §6 and §7 — "Capability category extensibility (the module contract pattern)": the five-artifact anatomy, the Grafana feature-flag worked example, the contract-test scaffold, the generator, and the review checklist. It also absorbs the `VcsProviderId` union-widening item as "rule 1 applied retroactively to existing contracts."

## 6. Can Users Choose What Providers in an Extension Group to Use Per Agentic Workflow Plugin?

**partially — the targeting half is there, the restriction half is not.** Let me break your scenario into its three distinct requirements, because they have different answers.

### Requirement A: Choosing a channel per call (e.g. Slack) — supported today

This works by design, no changes needed. `lookupChannel(teamOrService)` returns a provider-neutral `CommunicationChannel`, and `postMessage` targets a concrete `channelId`. A workflow that wants "notify the on-call engineer's channel" does:

1. `incident.oncall.get` → current on-call → owning team (that's the catalog-resolver `owner` path).
2. `communication.channel.lookup` with that team/service → channel.
3. `communication.message.post` to that channel.

That resolution is *workflow domain logic* — exactly where it belongs. The drift-detector plan already describes this ("resolve the inferred `Group` to a channel before outreach"). Context-sensitive targeting (per on-call engineer, per team, per service) is accommodated.

### Requirement B: Choosing a *provider* per call — not currently expressible

This is the gap. `PostMessageInput` has **no `providerId` field**, and the tool IDs (`communication.message.post`) are provider-independent by design. Today the module resolves "which driver?" internally, presumably from config or registration order — a single installation-wide answer. Your two plugins cannot say "plugin 1 → Slack,  plugin 2 → internal tool."

The fix is small and fits the contract philosophy: make provider selection an **explicit, optional dimension of the call** with a configured default:

```ts
export type PostMessageInput = {
  channelId: string;
  text: string;
  threadId?: string;
  /** Route to a specific registered provider; falls back to the configured default. */
  providerId?: string;
};
```

Same for `lookupChannel` (`teamOrService` + optional `providerId`, returning channels tagged with their provider). Default-resolution order: explicit arg → agent-level config → module-level default → limitation if ambiguous (never silently pick one — the VCS stub-driver lesson).

### Requirement C: *Restricting* which providers a plugin may use — needs a policy layer, and the refactor is the right place for it

Even with `providerId` on inputs, nothing today **prevents** plugin 1 from naming the internal tool. That's an authorization/policy concern, not a routing concern — and it maps directly onto machinery the refactor already introduces. `AgentDefinition` gains an optional provider policy, enforced by `ToolExecutor` (the single choke point every invocation passes through):

```ts
export type AgentDefinition = {
  // ...existing fields
  /** Per-category provider allow-list. Absent = any registered provider. */
  providers?: Record<string, readonly string[]>;  // e.g. { communication: ['slack'] }
};
```

Enforcement at dispatch: `ToolExecutor` knows the agent, the tool, the tool's category, and the resolved provider; a mismatch is a `tool_denied` error event, audited — same posture as allow-list and write-gating. Operators get a config mirror (`ai.agents.<id>.providers`) for installation-level overrides. This is structurally identical to how `toolIds` already scope *which tools* an agent may use; `providers` scopes *which backends* those tools may reach. Note it composes with Requirement B: policy constrains the set, `providerId` picks within it.

## Net answer

| Need                                              | Status                                                       |
| :------------------------------------------------ | :----------------------------------------------------------- |
| Per-call channel targeting (by team/on-call/etc.) | Supported — workflow logic via `lookupChannel`               |
| Per-plugin provider *selection*                   | Small contract addition: optional `providerId` on driver inputs + default resolution chain |
| Per-plugin provider *restriction*                 | New policy field on `AgentDefinition`, enforced in the refactor's `ToolExecutor` — one enforcement point, no per-plugin plumbing |

Worth noting the general principle this validates: the provider-neutral contract handles the *shape* of operations; routing and restriction are *cross-cutting policy* owned by the engine, never by duplicating tools per provider. Your instinct not to fork tools (`slack.message.post` vs `internal.message.post`) is the right one — that's the path that would recreate the cloud-providers normalization mess.

This belongs in the plan. I'd fold it into the capability-extensibility section we discussed: `providerId?: string` as a standard field on all driver input types (rule: "inputs may route, configs may default, agents may restrict"), plus the `providers` policy on `AgentDefinition` with `ToolExecutor` enforcement.

> Want me to write that section into `_CORE_REFACTOR.md` now, along with the earlier pending items (`BaseLLM` removal, `VcsProviderId` widening, usage table, configurable redaction policy)?

## Where are the Vector Embeddings Being Generated From?

Embeddings are created by **external LLM-provider embedding models** (AWS Bedrock, OpenAI), and the code that calls them lives in the **LLM modules** — not in the storage modules. The storage modules only persist and search vectors; they never generate them. The retrieval-augmenter module orchestrates the flow.

## The actual division of labor

Four layers, cleanly separated:

| Layer                    | Package                                                      | Role in embedding                                            |
| :----------------------- | :----------------------------------------------------------- | :----------------------------------------------------------- |
| **Embedding generation** | `plugin-ai-core-backend-module-llm-aws` / `-llm-openai`      | Calls the external provider API. Produces the vectors.       |
| **Orchestration**        | `plugin-ai-core-backend-module-retrieval-augmenter` (`DefaultVectorAugmentationIndexer`) | Chunks documents, wires embedder→store, runs the indexing/retrieval pipeline. |
| **Storage**              | `plugin-ai-core-backend-module-storage-pgvector` / `-storage-qdrant` | Persists vectors + similarity search. No generation.         |
| **Contract**             | `plugin-ai-core-node` (`@types/rag.ts`)                      | `VectorStore`, `EmbeddingDoc`, `AugmentationIndexer` types.  |

## How it actually works, concretely

**Storage modules are generation-agnostic.** Both stores hold an optional LangChain `Embeddings` reference injected from outside:



```ts
// PgVectorStore.ts:43,69 — same pattern in QdrantVectorStore.ts:68
protected embeddings?: Embeddings;
connectEmbeddings(embeddings: Embeddings) { this.embeddings = embeddings; }
```

`addDocuments` embeds-then-inserts (pgvector line 81-83: "@throws When no embeddings are configured"), and query-time similarity does `embedQuery` on the search text. But the store has no idea *which* provider is attached — it just calls the LangChain `Embeddings` interface.

**The LLM modules own the provider-specific embedding clients.** This is where the actual external calls happen:

- `llm-aws`: uses `@langchain/aws` `BedrockEmbeddings` for most models, plus a hand-written `BedrockCohereEmbeddings` wrapper (`BedrockCohereEmbeddings.ts`) because Cohere-on-Bedrock needs an `input_type` field (document vs query) and batching under its 66-doc payload limit. It calls `BedrockRuntimeClient.InvokeModelCommand` directly.
- `llm-openai`: `OpenAiAugmenter` reads `ai.embeddings.openai` config (`chunkSize`, `chunkOverlap`, `concurrencyLimit`) and calls OpenAI's embeddings endpoint.

Both module.ts files are explicit: *"does not register an executable chat model; deployments still need a model provider module or configured model extension for agent generation."* So these modules are **embeddings-only** — generation models are a separate concern (registered through `modelExtensionPoint`).

**The augmenter connects embedder to store.** `DefaultVectorAugmentationIndexer` (retrieval-augmenter) takes `{ vectorStore, embeddings }` and calls `vectorStore.connectEmbeddings(embeddings)` (line 94) — that's the moment the LLM module's embedder gets plugged into the storage module's store.

**One wiring wrinkle worth noting**: the LLM module *instantiates the store itself* — `llm-aws/module.ts` calls `createPgVectorStore({ logger, database, config })` directly. So today the Bedrock/OpenAI modules are **hard-coded to pgvector**. Qdrant exists as a `VectorStore` implementation, but no LLM module wires an embedder into it — you can't currently run "OpenAI embeddings into Qdrant" without editing the LLM module.

## The architectural smell (relevant to your refactor)

The dependency direction is inverted. Right now: **LLM module → imports → storage module** (`llm-aws` depends on `storage-pgvector`). That means embeddings-provider and vector-store are coupled in pairs — N embedders × M stores would need N×M module combinations.

The clean version (consistent with your capability-category pattern): both embedders and stores should register into core via extension points (`embeddingsExtensionPoint`, `vectorStoreExtensionPoint`), and the **retrieval-augmenter** should compose them — pick the configured embedder, pick the configured store, `connectEmbeddings`. Then OpenAI→Qdrant, Bedrock→pgvector, or a third-party embedder→third-party store are all just config choices, no module edits. That also fixes the "new provider needs a core PR" issue for the vector/embeddings category specifically.

It's the same seam discipline as the KMS serializer and the capability-category discussion. Want me to add an "embeddings/vector-store decoupling" item to the refactor plan's module section alongside the cloud-providers normalization?

## Usage Table Add and Future Monitoring Plugin

One caveat: token counts are only half of "spend." Real cost needs a __pricing map__ (`modelRef -> $/1K input/output tokens`) in config, applied either at write time (denormalize a `costUsd` column) or at query time. I'd put the pricing map in config and compute at query time so you can reprice history when provider pricing changes.

## 3. Drop `BaseLLM` — no value in keeping it

There is no value for this project. Reasons:

- **Every model module you have registers chat models.** The three LLM modules (`llm-aws`, `llm-openai`, `llm-openrouter`) wrap modern provider SDKs, which are all chat/message APIs. `BaseLLM` (single-string-in, string-out) exists for legacy completion endpoints that none of your providers use.
- **String prompts are the thing you're deleting anyway.** The plan removes `LlmService`'s `Human:\n…\nAssistant:` concatenation and moves to `SystemMessage`/`HumanMessage` arrays. `BaseLLM` support would mean maintaining a second, degraded prompt path in `ModelExecutor` — exactly the dual-path legacy drag you want to avoid.
- **Tool calling requires chat models.** `.bindTools()` / `tool_calls` only exist on `BaseChatModel`. Keeping `BaseLLM` in the type means every `ModelExecutor` consumer must handle a model that *can't* participate in the LLM-orchestrated path — a permanent type-level caveat.
- **Provider-neutrality is preserved.** `BaseChatModel` is still the LangChain abstraction; AWS/OpenAI/OpenRouter all satisfy it. You're not locking to a vendor, just to the message-based contract.

**Recommendation**: change `ModelDefinition.model` in core-node from `BaseLLM | BaseChatModel` to `BaseChatModel` only. The three LLM modules already comply; the typecheck will confirm. This also deletes the `BaseLLM` imports in core-backend's `plugin.ts`, `controller.ts`, and `factory.ts`.
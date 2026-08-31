## Multi-Provider Routing

The purpose of this feature is to allow an agentic workflow plugin (`plugin-ai-agent-backend-*`) have control over what provider implementations are invoked with a tool call.

### Verified current behavior

Multiple registrations are *accepted* but only one is *used*. Both `module-vcs` and `module-compliance` keep a `Map<providerId, driver>` (so `registerDriver` can be called N times), but at init they read a single provider key from config and resolve exactly one:

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

| Category            | Routing signal                                               | Fallback                                  |
| :------------------ | :----------------------------------------------------------- | :---------------------------------------- |
| VCS                 | `repoUrl` host                                               | config default → limitation               |
| Communication       | `providerId` arg (the field we discussed) → channel's provider | agent `providers` policy → config default |
| Observability       | `providerId` arg or per-query config                         | config default                            |
| LLM chat/embeddings | `modelRef` (already per-model!)                              | agent's `modelRef`                        |

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

| Plugin Name                        | Primary Routing Signal             | Dispatch Mechanism                                      | Security Risk Level       | Human-in-the-Loop Requirement               |
| ---------------------------------- | ---------------------------------- | ------------------------------------------------------- | ------------------------- | ------------------------------------------- |
| **Alert AI Tuner**                 | Incoming Alert Payload             | Target specific Infra VCS via Catalog Owner             | **High** (Writes Code)    | **Mandatory** (PR Review / Approval)        |
| **Catalog AI Insights**            | Current Active Catalog Entity      | Entity-Bound Context (Annotations)                      | Low (Read-only)           | None                                        |
| **Kubernetes AI Responder**        | Webhook Metadata / Component       | Entity-Bound Context + Observability lookup             | Medium (Live Infra Reads) | None (Investigation Phase)                  |
| **Oncall AI Handover Assistant**   | Time range + Team Context          | Scatter-Gather (Incidents + Comm Providers)             | Low (Read-only Summary)   | None                                        |
| **Release Notes AI Generator**     | Branch Diff / Trigger Payload      | Explicit (Cross-references VCS slug to Jira Project)    | Low (Read-only Reads)     | None                                        |
| **RFC ADR AI Reviewer**            | Input Document Location            | Entity-Bound + Scatter-Gather (API Schemas)             | Low (Read-only Audit)     | None                                        |
| **Scaffolder AI Drift Detector**   | Catalog Ancestry / Tech Radar      | Scatter-Gather (Scans all code matching templates)      | Low (Read-only Audit)     | None                                        |
| **Scaffolder AI Guardrail Agent**  | Input Parameters / Budget Policies | Scatter-Gather (Queries all compliance systems)         | Medium (Blocker Tool)     | None (Automated Policy)                     |
| **Scaffolder AI Infra**            | Selected Template Blueprint        | Explicit (Targets specific IaC module repos)            | **High** (Generates Code) | **Mandatory** (User reviews generated IaC)  |
| **Scaffolder AI Intent**           | Natural Language Prompt            | Explicit (Resolves prompt to a Catalog Template ID)     | Medium (Triggers action)  | **Mandatory** (Confirms template selection) |
| **Scaffolder AI PRD**              | Input Document Payload             | Explicit (Maps project info to Jira/Linear API)         | Medium (Writes Tasks)     | **Mandatory** (Review generated tickets)    |
| **Scaffolder AI Shadow Detective** | Cloud Provider APIs vs Catalog     | Scatter-Gather (Queries all cloud providers at once)    | Low (Read-only Audit)     | None                                        |
| **Search AI Archeology**           | Search Query String                | Scatter-Gather (Queries all ticket & wiki providers)    | Low (Read-only)           | None                                        |
| **Search AI Context**              | Search Query String                | Scatter-Gather (Queries all documentation providers)    | Low (Read-only)           | None                                        |
| **Tech Debt AI Scout**             | Entire Catalog / Global Scope      | Scatter-Gather (Loops over all registered codebases)    | Low (Read-only Audit)     | None                                        |
| **Techdocs AI Janitor**            | Storage Buckets + Catalog Owners   | Entity-Bound Context + Global Storage Buckets           | **High** (Creates PRs)    | **Mandatory** (PR Review / Approval)        |
| **Techdocs AI Postmortem**         | Trigger Incident ID / Timeline     | Explicit Parameter (User specifies Slack/PagerDuty IDs) | Low (Drafting text)       | None (Draft output)                         |
| **Tech Radar AI Manager**          | Telemetry / Lifecycle signals      | Scatter-Gather (Aggregates usage across all VCS/Logs)   | Low (Drafts Suggestion)   | **Mandatory** (Radar admin approval)        |

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
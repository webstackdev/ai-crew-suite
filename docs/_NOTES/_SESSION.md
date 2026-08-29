# Session Notes

## Why the AI Still Added All Plugins As Dependencies

Because you are using Vite as your Storybook builder (`@storybook/react-vite`), your AI likely ran into a generic Vite compilation or configuration error during a workspace-wide build.Instead of fixing the actual root cause (like a missing global style, an unconfigured Vite alias, or a misconfigured tsconfig.json paths mapping), the AI used a brute-force approach. It assumed that if every plugin knows about every other plugin's package path, whatever missing reference Storybook or Vite was complaining about would magically resolve.It worked to silence the compiler error, but it left you with a highly bloated and fragile dependency configuration.

## Event questions

The token event is a RAW string. All other event types are emitted as structured JSON objects.

In Roadie's architecture, text generation chunks are pumped directly to the Server-Sent Events (SSE) stream to minimize parsing overhead on the client side. Tokens are often small 3-byte payloads and wrapping them in JSON introduces stuttering in the frontend UI and network overhead.

- The data shape on the wire: data: " structured" or data: " code"
- The Danger: Passing this raw string chunk directly into JSON.parse() will instantly throw an exception and route execution directly into your catch block.

- Extract a BaseGraphRunner class abstraction to encapsulate this safeParse logic across all 18 graph workflow run blocks
- Code the Frontend UI Client hook integration that triggers this exact alert-ai-tuner payload typesafely
- Design the validation rules for one of your supporting utility modules (e.g., the Slack or GitHub service channels)

Now that the backend contract is complete and verified, let me know if you would like to:

- Step forward into the shared frontend workspace to configure your AiAgentClientFactory layer typesafely
- Set up the matching Frontend Client Factory in your shared frontend package to trigger this alert-ai-tuner typesafely
- Design the Zod contract configuration schemas for your next agent plugin sequence (e.g., catalog-ai-insights)

## Prompts

I have a turbo monorepo of agentic workflow plugins for Spotify's backstage. It has a group of 18 agentic workflow plugins named in the pattern plugin-ai-agent-backend-*. Tests are in a __tests__ folder in the directory of code files.

We also have a plugins/backend/plugin-ai-core-backend and its associated plugins/backend/plugin-ai-core-node plugin. There are also plugins following a plugins/backend/plugin-ai-core-backend-module-* naming scheme that provide access to third-party platforms through a uniform interface, and to external storage and llm providers.

I'm working through improving the code quality of plugins. Implementation code should be enterprise-quality and highly robust. Unit test coverage should be robust.

## Production code issues

------
Deleted unused imports in `workflow/AlertTunerGraph.ts`:

- `AlertTuningRequestValidationError` from `request.ts`
- `AlertTuningRequest` from `state.ts`
------

3. Untyped Integration Payloads (`toSuppressionWindows`)

In `correlate.ts`, `toSuppressionWindows` consumes raw output rows with a loose structural check:

typescript

```
const rows = Array.isArray(records) ? records : [];
```

Use code with caution.

The method then manually loops through strings like `triggeredAt`, `startedAt`, `observedAt`, and `timestamp` to guess which field contains the timestamp.

- **The Problem:** This design bypasses type checking at your network boundaries. It assumes that downstream utility tools (Slack modules, GitHub integrations, pager modules) map their outputs to one of those four hardcoded string names.
- **The Risk:** If a downstream module upgrades its dependency framework and renames its output payload layout fields (e.g., from `startedAt` to `createdAt` or `time`), the loop will silently ignore the entire row dataset. It returns an empty list instead of failing explicitly, which blinds your automated tuning graphs to real ongoing production incident signals.
- **The Fix:** Instead of passing an unverified array down-funnel, use strict Zod validation schemas right at the output boundary of your tool modules (the Slack and GitHub wrappers) to normalize payloads into a standard type before they reach the workflow layer.

------

4. Direct, Unguarded Network Calls in Schedulers

In `weeklySweep.ts`, the background task fires native `fetch` requests inside a loop directly to the engine's REST paths:

typescript

```
const response = await fetch(`${base}/agents/${ALERT_AI_TUNER_AGENT_ID}/runs`, { ... });
```

Use code with caution.

- **The Problem:** This completely bypasses the Backstage plugin communication layers, requiring manual management of headers, authorization tokens, content types, and error states.
- **The Risk:** If the core engine URL shifts slightly due to sub-route base mapping flags, or if the payload wrapper structures mutate during a framework upgrade, the scheduler will fail silently, logging basic warnings rather than leveraging a centralized API bridge client interface.
- **The Fix:** Abstract this communication layer. The scheduler should use the centralized **`AiAgentClientFactory`** we designed to trigger runs typesafely over an explicit interface hook rather than manually executing raw `fetch` string concatenations.

------

5. Silent Degradation via `try/catch` Swallowing

In `TunerToolRunner.ts`, the `invoke` method wraps its execution block in a generic catch-all trap:

typescript

```
} catch (error) {
  // ... logs warning and returns undefined
  return undefined;
}
```

Use code with caution.

- **The Problem:** While fault isolation is good, treating *all* errors identically obscures critical runtime infrastructure problems.
- **The Risk:** If a network call fails due to a temporary network blip, returning `undefined` is appropriate. However, if it fails due to a **database connection failure**, an **expired authorization token**, or an **out-of-memory fatal crash**, swallowing the exception and returning `undefined` misleads the orchestration engine into thinking the tool completed with "empty data," rather than failing due to platform issues.
- **The Fix:** Differentiate your errors. Catch and handle transient operational errors safely, but explicitly re-throw system-level anomalies (such as authentication failures or memory exhaustion tokens) to allow the orchestration runtime to halt the execution immediately.


# Session Notes

## Prompts

I have a turbo monorepo of agentic workflow plugins for Spotify's backstage. It has a group of 18 agentic workflow plugins named in the pattern plugin-ai-agent-backend-*. Tests are in a __tests__ folder in the directory of code files.

We also have a plugins/backend/plugin-ai-core-backend and its associated plugins/backend/plugin-ai-core-node plugin. There are also plugins following a plugins/backend/plugin-ai-core-backend-module-* naming scheme that provide access to third-party platforms through a uniform interface, and to external storage and llm providers.

I'm working through improving the code quality of plugins. Implementation code should be enterprise-quality and highly robust. Unit test coverage should be robust.

## Docs

We generated a number of new items to add to the refactor plan during our audit of enterprise and compliance issues. I had these notes and add them here as a future todo:

1. We need to keep a good list of the user seams to update our documentation with. An example is the the *seam* for an immutable backend immutable append-only audit log. Let's add these items to the bottom of the backend-core-plugin's README.md doc. We do not need to worry about formatting that doc or writing good end user documentation - just note it. We'll rewrite that doc entirely later.

2. Let's also add a list of the enterprise features we're adding in a section at the bottom of the backend-core-plugin's README.md doc. Again, we'll rewrite it later so no need for generating high quality documentation - just notes we can reference. We want to provide a checklist that an enterprise user or user in a strict compliance environment could look at to determine if our product meets their requirements. It may include features not on this list, but that are already in our refactor plan or in our current implementation.

## Production code issues

### Direct, Unguarded Network Calls in Schedulers

In `weeklySweep.ts`, the background task fires native `fetch` requests inside a loop directly to the engine's REST paths:

```typescript
const response = await fetch(`${base}/agents/${ALERT_AI_TUNER_AGENT_ID}/runs`, { ... });
```

- The Problem: This completely bypasses the Backstage plugin communication layers, requiring manual management of headers, authorization tokens, content types, and error states.

- The Risk: If the core engine URL shifts slightly due to sub-route base mapping flags, or if the payload wrapper structures mutate during a framework upgrade, the scheduler will fail silently, logging basic warnings rather than leveraging a centralized API bridge client interface.

- The Fix: Abstract this communication layer. The scheduler should use the centralized `AiAgentClientFactory` we designed to trigger runs typesafely over an explicit interface hook rather than manually executing raw `fetch` string concatenations.

### Silent Degradation via `try/catch` Swallowing

In `TunerToolRunner.ts`, the `invoke` method wraps its execution block in a generic catch-all trap:

```typescript
} catch (error) {
  // ... logs warning and returns undefined
  return undefined;
}
```

- The Problem: While fault isolation is good, treating *all* errors identically obscures critical runtime infrastructure problems.

- The Risk: If a network call fails due to a temporary network blip, returning `undefined` is appropriate. However, if it fails due to a database connection failure, an expired authorization token, or an out-of-memory fatal crash, swallowing the exception and returning `undefined` misleads the orchestration engine into thinking the tool completed with "empty data," rather than failing due to platform issues.

- The Fix: Differentiate your errors. Catch and handle transient operational errors safely, but explicitly re-throw system-level anomalies (such as authentication failures or memory exhaustion tokens) to allow the orchestration runtime to halt the execution immediately.

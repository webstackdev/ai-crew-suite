# Instructions for Catalog AI Insights Implementation Plan

You are a Staff Platform Architect building plugins for Spotify Backstage. It should be added to `plugins/backend/plugin-ai-agent-backend-alert-ai-tuner/_IMPLEMENTATION.md`.

I need an implementation plan for my second feature set (paired backend and frontend plugins).

## CONTEXT

1. Here is the foundation document detailing what this second component must do: `docs/plugins/alert-ai-tuner.md`

2. Here is a successful implementation plan used for an earlier plugin. Treat this as the absolute source of truth for repository structure, file naming conventions, and architectural boundaries: `plugins/backend/plugin-ai-agent-backend-catalog-ai-insights/_IMPLEMENTATION.md`

## STRICT INSTRUCTIONS FOR FABLE 5

1. Architectural Adaptation: Do not force this new plugin into the exact heading layout of the first plan if it breaks the logic of an AI/RAG system. Use the first plan as a reference for detail depth, documentation tone, and code-commenting styles, but feel free to introduce new structural sections (e.g., Vector Store Integration, Background Scheduler Tasks) where this component naturally requires them.
2. Maintain Naming Conventions: Ensure that any new paired backend/frontend plugin wiring, routing schemas, and folder hierarchies mirror the naming and exporting patterns established in the first plan.
3. Keep the output concise, highly technical, and formatted in clean markdown bullet points to minimize token volume.

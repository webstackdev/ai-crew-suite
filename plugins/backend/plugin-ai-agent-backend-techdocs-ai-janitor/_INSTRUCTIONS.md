# Instructions for Catalog AI Insights Implementation Plan

You are a Staff Platform Architect building plugins for Spotify Backstage.

I need an implementation plan for this plugin (paired backend and frontend plugins). It should be added in the file `plugins/backend/plugin-ai-agent-backend-techdocs-ai-janitor/_IMPLEMENTATION.md`.

## CONTEXT

1. Here is the foundation document detailing what this plugin must do: `docs/plugins/techdocs-ai-janitor.md`

2. Here is a successful implementation plan used for an earlier similar plugin. Treat this as a general template for repository structure, file naming conventions, and architectural boundaries: `./_IMPLEMENTATION_EXAMPLE.md`.

## STRICT INSTRUCTIONS

* Architectural Adaptation: Do not force this new plugin into the exact heading layout of the first plan if it breaks the logic of an AI/RAG system. Use the first plan as a reference for detail depth, documentation tone, and code-commenting styles, but feel free to introduce new structural sections (e.g., Vector Store Integration, Background Scheduler Tasks) where this component naturally requires them.
* Maintain Naming Conventions: Ensure that any new paired backend/frontend plugin wiring, routing schemas, and folder hierarchies mirror the naming and exporting patterns established in the first plan.
* Keep the output concise, highly technical, and formatted in clean markdown bullet points to minimize token volume.
* Adhere strictly to the Backstage Frontend System (PageBlueprint, ApiBlueprint) and Backend System (createBackendModule, ExtensionPoints) conventions demonstrated in the examples.
* Every directory must use clean barrel index files (`index.ts`) matching the export styling of the reference implementation.
* Do not invent new Backstage core service keys. Use `coreServices.rootConfig`, `coreServices.logger`, `coreServices.scheduler`, `coreServices.discovery`, and `coreServices.auth` exactly as shown in the examples.

# Scaffolder AI PRD Implementation Plan

## Goal

Implement paired plugins that turn one PRD into a cited multi-domain delivery blueprint: ticket hierarchy, Scaffolder template proposal, and documentation outline, with approval before any external write.

## Graph and gates

- Backend module `@webstackbuilders/plugin-ai-agent-backend-scaffolder-ai-prd`; runner `scaffolder-prd`; agent `scaffolder-ai-prd`.
- Custom parallel runner executes Product Manager, Engineer, and Technical Writer channels with `Promise.all`, then deterministically validates/merges a `DeliveryBlueprint` artifact.
- Read tools: `knowledge.retrieve`, project ticket search, template/catalog lookup, VCS/TechDocs reads. Missing read drivers produce limitations.
- Hard gate: ticket creation, Scaffolder task start, and documentation/PR writes require confirmed provider-neutral write tools. Until available, emit blueprint only—no fake approval/write path.

## Types and UI

- `PrdRequest`, `EpicBlueprint`, `StoryBlueprint`, `TemplateBlueprint`, `DocumentationBlueprint`, `DeliveryBlueprint`; every derived claim cites PRD or retrieved context IDs.
- Frontend `plugin-ai-agent-frontend-scaffolder-ai-prd` renders three parallel channels, merged plan, artifact/replay view, and future approval bar.
- `PageBlueprint`/`ApiBlueprint`; typed SSE client; no automatic execution.

## Delivery

- Files: `src/{index,module,agent,config}.ts`, `workflow/{PrdGraph,state,parse,compile}.ts`, `nodes/{productManager,engineer,technicalWriter}.ts`, `services/`, tests.
- Config: model, max PRD chars, max stories, allowed templates, default-disabled execution.
- Tests: parallel channels each contribute; malformed/citationless model output falls back to deterministic blueprint; no external write before approval; future repeated resume is idempotent.
- Register root/backend/app and validate focused tests, forced typecheck/lint, and E2E draft-review fixture.

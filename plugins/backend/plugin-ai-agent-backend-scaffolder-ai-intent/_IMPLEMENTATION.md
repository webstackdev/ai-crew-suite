# Scaffolder AI Intent Implementation Plan

## Goal

Implement paired plugins that transform a natural-language provisioning request into a validated Scaffolder template selection and parameter proposal, then require user confirmation before task creation.

## Backend workflow

- Backend module `@webstackbuilders/plugin-ai-agent-backend-scaffolder-ai-intent`; runner `scaffolder-intent`; agent `scaffolder-ai-intent` with session memory.
- Confirm a typed template-schema discovery and task-start contract before implementation; do not invent a Scaffolder service reference.
- Flow: parse request → retrieve/select allowed template → map text into typed schema parameters → validate catalog name availability and policy constraints → return correction questions or `template-intent-proposal` artifact → explicit user confirmation calls the real Scaffolder task API.
- Use `knowledge.retrieve` only for template guidance. Deterministic schema validation decides validity; model output is parsed against a strict proposal schema.

## State and frontend

- Types: `IntentRequest`, `TemplateCandidate`, `ParameterProposal`, `ValidationIssue`, `ScaffolderIntentProposal`.
- Frontend `plugin-ai-agent-frontend-scaffolder-ai-intent`: `ApiBlueprint`, Scaffolder entry extension, confirmation page, conversational correction form, SSE/replay deep links.
- Render selected template, confidence, filled values, unavailable-name errors, and required user edits; never auto-create a task.

## Tests and delivery

- Package structure follows agent module/barrel conventions: `workflow/{IntentGraph,parse,select,validate}.ts`, `services/TemplateResolver.ts`, tests.
- Config includes model, allowed template refs, max correction turns, and default-disabled task execution.
- Unit: schema coercion, template ranking, collision detection.
- Workflow: “create react app payment-gateway” selects template then returns name collision; corrected name reaches confirmation; duplicate requests reuse idempotency record; no task before confirmation.
- Register backend/frontend/root/app wiring; validate Vitest, forced typecheck/lint, and browser fixture flow.

# TechDocs AI Janitor Implementation Plan

## Goal

Implement paired plugins that detect documentation drift, dead links, ownership staleness, and telemetry-driven gaps, then generate cited patch proposals without modifying source until VCS write support is approved.

## Backend graph

- Module `@webstackbuilders/plugin-ai-agent-backend-techdocs-ai-janitor`; runner `techdocs-janitor`; agent `techdocs-ai-janitor`.
- Inputs: one entity/doc path or a bounded trigger. Flow: load catalog/doc source → scan deterministic discrepancies → retrieve active docs/catalog context → propose validated markdown patch → emit `techdocs-janitor-report` and optional `documentation-patch` artifacts.
- Read tools: VCS file read/search, `knowledge.retrieve`, catalog resolver, optional search telemetry once a typed telemetry contract exists.
- Gates: catalog relation resolver, telemetry API, VCS PR/file-write tool, and events subscription are shared work. Draft-only until available; no automatic PRs.

## Frontend and safety

- `plugin-ai-agent-frontend-techdocs-ai-janitor`: entity-doc panel and standalone queue, discrepancy/patch diff preview, limitations, replay, future approval bar.
- Types: `JanitorRequest`, `JanitorDiscrepancy`, `DocumentationPatch`, `JanitorReport` with citations.
- Cap document/patch sizes, redact secrets, preserve exact source ranges, and require human approval for every source mutation.

## Tests and delivery

- Unit: dead-link classification, ownership comparison, patch applies exactly once.
- Workflow: stale API/owner produces bounded patch; unknown replacement remains recommendation; telemetry gap creates outline only.
- Register root/backend/app; add triggered/scheduled fixture tests and forced typecheck/lint.

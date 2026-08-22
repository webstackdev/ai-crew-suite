# Search AI Context Implementation Plan

## Goal

Implement paired plugins that perform bounded cross-service impact analysis for an API/schema change, producing a cited Impact Assessment across dependent components and owners.

## Backend graph

- Module `@webstackbuilders/plugin-ai-agent-backend-search-ai-context`; runner `cross-service-impact`; agent `search-ai-context`.
- Input: one source entity/API plus mutation/search signature; reject unscoped organization scans.
- Flow: resolve bounded catalog dependency graph → retrieve docs/schema context → validate candidate consumer repositories with `vcs.repository.search` → group impacted/unaffected/unknown consumers → deterministic severity/owner rollup → `impact-assessment` artifact.
- Gate: shared `CatalogEntityResolver`/relation traversal must exist before implementation; event subscription is deferred until a confirmed events contract is wired. No writes in v1.

## Frontend

- `plugin-ai-agent-frontend-search-ai-context` standalone page and optional entity tab using `ApiBlueprint`/`PageBlueprint`.
- Show dependency graph depth, impacted code references, owners, unknown validations, citations, limitations, live SSE, and replay.

## Tests and delivery

- Types: `ImpactRequest`, `DependencyNode`, `ValidationEvidence`, `ImpactAssessment`.
- Unit: cycle-safe graph traversal, depth cap, deterministic severity rollup.
- Workflow: two catalog dependents both validate; one code match is impacted and one is unaffected; unavailable VCS is unknown/partial.
- Register root/backend/app; validate focused tests, forced typecheck/lint, and multi-tier dependency fixture E2E.

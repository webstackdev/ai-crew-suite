# Scaffolder AI Shadow Detective Implementation Plan

## Goal

Implement paired plugins that reconcile cloud inventory against catalog bindings, infer likely ownership for orphaned assets, and produce safe claim/decommission remediation proposals.

## Backend workflow

- Module `@webstackbuilders/plugin-ai-agent-backend-scaffolder-ai-shadow-detective`; runner `shadow-resource-reconciliation`; agent `scaffolder-ai-shadow-detective`.
- Scheduler dispatches authenticated, persisted scans using `rootConfig`, `logger`, `scheduler`, `discovery`, and `auth`; scans are opt-in, globally mutexed, cursor/checkpoint bounded.
- Flow: inventory cloud assets through registered cloud tools → match deterministic catalog annotations → infer ownership from tags/billing/creator evidence → create Scaffolder claim URL → emit `shadow-resource-report`.
- Read-only first. Slack message posting and catalog mutation require `communication.message.post`/catalog write contracts plus approval; do not implement fictional cloud, Slack, or catalog services.

## Types, UI, safety

- `ResourceFingerprint`, `OwnershipHypothesis`, `ShadowResource`, `ShadowResourceReport`, stable evidence IDs and per-resource dedupe key.
- Frontend `plugin-ai-agent-frontend-scaffolder-ai-shadow-detective`: review page/card with inventory status, ownership confidence, claim-template deep links, scheduled replay history once runs-list API exists.
- Cap resources/provider and evidence bytes; redact tag secrets; never notify twice for same fingerprint without a material state change.

## Tests and delivery

- Files: `workflow/{ReconciliationGraph,state,inventory,match,ownership}.ts`, `scheduler/{scanPlanner,weeklyScan}.ts`, `services/`, tests.
- Config: model, providers, scan cap, dedupe TTL, claim template ref, cadence disabled by default.
- Test registered vs orphan filtering, ownership inference, duplicate-scan suppression, cursor resume, absent cloud driver degradation, and no outbound message before approval.
- Register root/backend/app; validate focused Vitest, forced typecheck/lint, and cloud fixture E2E.

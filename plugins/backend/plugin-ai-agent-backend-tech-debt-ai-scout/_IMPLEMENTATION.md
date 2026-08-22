# Tech Debt AI Scout Implementation Plan

## Goal

Implement paired plugins that periodically identify, prioritize, and report technical-debt hotspots from bounded repository scans without creating tickets or scorecard mutations until write contracts exist.

## Backend workflow

- Module `@webstackbuilders/plugin-ai-agent-backend-tech-debt-ai-scout`; runner `tech-debt-scout`; agent `tech-debt-ai-scout`.
- Scheduled scans are opt-in and dispatch persisted AI Core runs. Scanner reads bounded manifests/source through VCS tools; triager deterministically recognizes TODO/FIXME/deprecated dependency/secret-like patterns; reporter emits `tech-debt-report`.
- `knowledge.retrieve` enriches known deprecations/CVEs; model only rewrites cited summaries.
- Gate: project ticket create/comment and quality-scorecard write tools are absent. Keep reporting/advisory mode until provider-neutral write tools and approval policies exist.

## Data and frontend

- `DebtSignal`, `DebtFinding`, `DebtReport`, stable snippet hash for dedupe and owner/repo citations.
- Frontend `plugin-ai-agent-frontend-tech-debt-ai-scout`: scheduled report dashboard, finding severity, suppressed low-value TODOs, remediation links, replay.
- Cap repositories/files/snippet bytes; redact secrets before artifacts; suppress duplicate fingerprints across scans.

## Tests and delivery

- Unit: security FIXME/deprecated dependency outranks generic TODO; fingerprint stability; suppression rules.
- Workflow: scanner → triager → reporter preserves only actionable findings; missing VCS degrades; second scan does not duplicate report action.
- Add `scheduler/{planner,sweep}.ts`, register root/backend/app, and validate Vitest, forced typecheck/lint, E2E fixtures.

# Tech Radar AI Manager Implementation Plan

## Goal

Implement paired plugins that measure bounded technology adoption/deprecation signals, compare them with a radar source, and emit reviewable radar-change proposals without altering radar data or opening tickets until write contracts exist.

## Backend workflow

- Module `@webstackbuilders/plugin-ai-agent-backend-tech-radar-ai-manager`; runner `tech-radar-analysis`; agent `tech-radar-ai-manager`.
- Scheduler dispatches opt-in persisted scans. Flow: read radar source → enumerate bounded catalog repositories → scan manifests through VCS search/read → calculate adoption velocity deterministically over persisted observations → generate `tech-radar-proposal` artifact.
- Read inputs: VCS manifest reads, catalog repo annotations, radar file via VCS/url reader, `knowledge.retrieve` for policy context.
- Gates: durable longitudinal metrics store/contract, radar write API, project ticket write tool, and events subscription for PR updates. Start with proposal-only scheduled/manual runs.

## Data, frontend, safety

- `RadarEntry`, `AdoptionObservation`, `TrendFinding`, `RadarProposal`; threshold/ring transitions deterministic and cited.
- Frontend `plugin-ai-agent-frontend-tech-radar-ai-manager`: radar proposal dashboard, adoption evidence, quarterly summary, replay, future approval controls.
- Cap repositories/manifests, retain aggregate counts rather than raw dependency files, and never mutate radar/tickets without approval and provider write support.

## Tests and delivery

- Unit: 30% adoption threshold maps Assess → Trial proposal; hold/EOL dependency creates affected-owner finding; deterministic 90-day rollup.
- Workflow: multi-repo manifest fixtures yield proposal; unavailable repo search is partial; repeated scan preserves dedupe.
- Register root/backend/app; add scheduler tests, forced typecheck/lint, and radar fixture E2E.

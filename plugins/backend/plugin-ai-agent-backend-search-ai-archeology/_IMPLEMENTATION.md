# Search AI Archeology Implementation Plan

## Goal

Implement paired plugins that combine RAG, bounded VCS/ticket history, and catalog org mapping to produce a cited Expertise Matrix for legacy systems.

## Backend design

- Module `@webstackbuilders/plugin-ai-agent-backend-search-ai-archeology`; runner `knowledge-archeology`; agent `search-ai-archeology` with session memory for iterative research.
- Route `/agents/search-ai-archeology/runs`; read tools: `knowledge.retrieve`, `vcs.repository.search`, approved historical VCS/blame tool when registered, `project.ticket.search`, catalog identity lookup.
- Current gate: no generic blame/history tool or shared catalog identity resolver. Milestone 1 uses retrieval/search and preserves unavailable-history/identity limitations; add provider-neutral history and resolver contracts before expert scoring from them.
- Flow: validate bounded repo/topic/time window → retrieve target files/ADRs → query history/tickets → map identities to current org graph → rank evidence deterministically → model summarizes only cited evidence → `expertise-matrix` artifact.

## Frontend and safety

- `plugin-ai-agent-frontend-search-ai-archeology` standalone research page with query/time scope, live investigation timeline, expertise matrix, legacy/deactivated identity labels, citations, and replay.
- Limit repos/files/history records, enforce caller authorization through AI Core identity propagation, and avoid persisting personal data in vector stores.

## Tests and delivery

- Pure ranking: active owner/reviewer evidence outranks stale author; unknown legacy account remains labeled rather than fabricated.
- Workflow: rate-limit failure resumes/degrades without losing collected evidence; retrieval-only outcome remains useful.
- Package layout: `workflow/{ArcheologyGraph,state,rank,identity}.ts`, `retrieval/`, `services/`, frontend API/hook/panels.
- Register root/backend/app; validate Vitest, forced typecheck/lint, and legacy-author fixture E2E.

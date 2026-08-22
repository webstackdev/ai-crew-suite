# TechDocs AI Postmortem Implementation Plan

## Goal

Implement paired plugins that aggregate bounded incident, observability, VCS, and communication evidence into a cited postmortem timeline draft, requiring approval before any documentation commit.

## Backend workflow

- Module `@webstackbuilders/plugin-ai-agent-backend-techdocs-ai-postmortem`; runner `postmortem-timeline`; agent `techdocs-ai-postmortem`.
- Input: one incident ID/entity/time window. Flow: resolve incident → gather incident metadata, dashboards/log summaries, deploy/PR changes, and channel history → normalize chronological evidence → deterministic timeline ordering → model writes cited narrative → emit `postmortem-draft` artifact.
- Read tools: incident, observability, VCS, communication history, `knowledge.retrieve`; all source failures become limitations.
- Gates: typed events subscription for resolution hooks and VCS/TechDocs write tool for markdown commit/PR. Keep manual, draft-only workflow until those contracts land.

## Frontend and tests

- `plugin-ai-agent-frontend-techdocs-ai-postmortem`: incident picker, timeline, cited narrative, limitations, replay, future approval/publish banner.
- Types: `PostmortemRequest`, `TimelineEvent`, `PostmortemDraft`, `PostmortemPublication`.
- Unit: stable chronological sort, duplicate event collapse, citation validation.
- Workflow: Slack/alert/PR events merge in time order; unavailable communication is partial; no documentation write pre-approval.
- Register root/backend/app and validate focused tests, forced typecheck/lint, incident fixture E2E.

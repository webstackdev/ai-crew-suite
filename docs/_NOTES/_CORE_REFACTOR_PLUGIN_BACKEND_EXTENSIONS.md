# Third-Party Platform Extension Modules — Refactor Plan

Covers the eight driver-based groups that access third-party platforms: cloud-providers, communication, compliance, incident-management, observability, project-management, quality-scorecards, and vcs. It answers "what work (if any) is required in this group" after the `plugin-ai-core-node` contract refactor (widened provider IDs, `canHandle` predicate) and `plugin-ai-core-backend` engine refactor (`ToolExecutor` handles provider RBAC filtering and scatter-gather) — both assumed complete.

**Group members** (8 core extension modules + 19 provider sub-plugins):
- `plugin-ai-core-backend-module-cloud-providers` (+ aws, azure, gcp)
- `plugin-ai-core-backend-module-communication` (+ slack)
- `plugin-ai-core-backend-module-compliance` (+ opa)
- `plugin-ai-core-backend-module-incident-management` (+ pagerduty)
- `plugin-ai-core-backend-module-observability` (+ datadog)
- `plugin-ai-core-backend-module-project-management` (+ jira)
- `plugin-ai-core-backend-module-quality-scorecards` (+ scorecards, soundcheck, techradar)
- `plugin-ai-core-backend-module-vcs` (+ aws-codecommit, azure, bitbucket, gerrit, git, github, gitlab)

## Group Audit

Group-by-group audit shows most modules satisfy the refactor unchanged; only a few differences are material, organized into three work buckets:

- **Bucket A — Single-provider resolution** (like VCS): `cloud-providers` (after a correctness check on the actual tool definition shape — the old `_IMPLEMENTATION.md` note about broken shapes was stale), `compliance`, `incident-management`, `observability`, `project-management`. They resolve a single active driver from config and build tools from it. That is fine; routing belongs in the category module anyway.
- **Bucket B — Closed provider-ID unions** (break under the new widened `VcsProviderId = string & {...}` in core-node): `vcs` whose `config.ts` has `isVcsProviderId` hardcoded guard against a `SUPPORTED_PROVIDERS` list. It would now reject valid third-party providers and no longer type-check under the widened brand.
- **Bucket C — Scatter-gather routing eligibility** (optional): `cloud-providers` (marked `supportsScatterGather: true` where useful — e.g. shadow-detective/archeology fan-out).

So there is work to do, but it's scattered and specific. Most modules need only a provider-conversion + config tightening; only `vcs` needs actual code changes.

---

## Group 1 — `plugin-ai-core-backend-module-vcs` (the only material break)

### Problem

`vcs/config.ts` hardcodes `SUPPORTED_PROVIDERS` as a readonly list and validates the configured `provider` string with `isVcsProviderId(value)`. After the core-node refactor, `VcsProviderId` is `string & { __brand?: 'VcsProviderId' }`, so the literal list check both unnecessary and wrong (it would reject valid third-party providers, and the brand prevents the closed-union literal test).

### Fix

- Delete `SUPPORTED_PROVIDERS` and `isVcsProviderId` from `vcs/config.ts`.
- Keep `provider: string` (open string, non-empty validation).
- For future multi-provider routing (host-based dispatch), accept `VCS_PROVIDERS` constants as hints rather than closed lists.

## Group 2 — `plugin-ai-core-backend-module-cloud-providers`

### Audit Correctness Verified

`src/registerTools.ts` emits real `ToolDefinition` (`id`, `effect: 'read'`, `invoke`), not LangChain-shaped `{name, execute}` — the old `_IMPLEMENTATION.md` note about broken shapes was stale. `src/module.ts` resolves a single provider from config (`defaultProvider`), following the correct pattern for the category. This is fine.

### Optional scatter-gather

The capability-category pattern recognizes `supportsScatterGather: true` in `cloud-providers` (useful for shadow-detective/archeology fan-out). To implement it, change the category module (not the driver):
- Mark the category `supportsScatterGather: true` in its tool factory metadata (optional; opt-in).
- `ToolExecutor` (in core-backend) handles fan-out to all allowed providers via `invokeAll`.

No driver changes are needed. Single-provider resolution is preserved as the default; scatter-gather is opt-in.

## Group 3 — `plugin-ai-core-backend-module-communication` — channel-derived routing note

Correct today: resolves a single provider from config (currently `slack`) and builds event-driven tools from channel lookups/provider IDs. No immediate changes needed. Channel-based routing (optional `providerId` on `PostMessageInput`) belongs in the category module when multiple providers register and need it; punt down the field when asked.

## Group 4 — `plugin-ai-core-backend-module-compliance` — fine

Verified: the OPA driver returns uniform `safe`/`unsafe` verdicts. No changes needed; the category module resolves a single provider from config as it should.

## Group 5 — `plugin-ai-core-backend-module-incident-management` — fine

PagerDuty driver covers alert history, incident list/get, oncall get, and annotate. Correct shape; no changes needed.

## Group 6 — `plugin-ai-core-backend-module-observability` — fine

Datadog registers via `observabilityDriversExtensionPoint` covering logs/metrics/traces/dashboards. Correct shape; no changes needed.

## Group 7 — `plugin-ai-core-backend-module-project-management` — fine

Jira registers via `projectManagementDriversExtensionPoint` covering tickets (create, comment, get, search). Correct shape; no changes needed.

## Group 8 — `plugin-ai-core-backend-module-quality-scorecards` — fine

`extensions.ts` exposes `registerDriver` (not a double-registration restriction). No additional changes needed at this stage; the technical issue (durable TechRadar proposals) is documented honestly as an in-memory `Map` in the TechRadar sub-plugin.

---

## Execution Sequence

If the API fixes limited to `vcs` only (Bucket B) and scatter-gather semantics are deferred (Bucket C), only two groups have work. Both categories abort the others unchanged.

1. **Group 1 — `plugin-ai-core-backend-module-vcs`**: optionally, delete `SUPPORTED_PROVIDERS` + `isVcsProviderId` and keep `provider: string` non-empty config validation. This is the minimal toleration of the provider-ID widening break.
2. **Group 2 — `plugin-ai-core-backend-module-cloud-providers`** (optional): mark the category `supportsScatterGather: true` in the tool factory metadata. Everything else unchanged.
3. All other groups: no changes required; conclude that the provider conversion is complete as-is.

## Validation (no typecheck/lint/test run per your current instruction)

- `vcs`: config validation now rejects only empty `provider` strings; type checks under widened `VcsProviderId`.
- `cloud-providers`: if opting into scatter-gather, the category declares the flag; otherwise unchanged.
- All others: registered unchanged.

## Done criteria for this group

- No Bucket-B break remains (`vcs/config.ts` no longer restricts provider IDs with a hardcoded list).
- Buckets A and C are either optional or out of scope.
- The remaining six groups stay **no-changes-required**, as this is a scattered audit.

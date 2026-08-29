# AI Core Node — Aggregated Roadmap Items

Aggregated from the 18 agentic workflow plugins' `_ROADMAP_IMPLEMENTATION.md` files.

## 1. Scaffolder helper library (`src/scaffolder/`) — unbuilt

- Bounded blueprint/provenance reads: `getComponentBlueprint`/template-spec read for a catalog entity's scaffold origin.
- **Consumers**: scaffolder-ai-drift-detector (golden-path spec), scaffolder-ai-guardrail-agent (v2 enforcement also needs a Scaffolder pre-flight interception point — no `createTemplateAction` consumer or `scaffolderActionsExtensionPoint` use exists today), scaffolder-ai-infra (blueprint sourcing).
- Note: scaffolder-ai-intent proved the real `scaffolderServiceRef` (`@backstage/plugin-scaffolder-node` v0.13.5) works directly; reuse its adapter patterns.

## 2. `CatalogEntityResolver` additions

- Add `findUserByEmail(email)` (or generic `findByField`) and `memberOf` traversal via `getRelations`.
- **Consumer**: search-ai-archeology (email → User → owning Group mapping; unresolvable identity must remain a first-class `offboarded` outcome).

## 3. `token` event node label

- `src/@types/run.ts` (~line 297): `token` data is `{ runId, text }`; add optional `node?: string` (backward compatible). `step` events already carry `node`.
- **Consumers**: rfc-adr-ai-reviewer and scaffolder-ai-prd per-node token streaming in the UI. Blocking for that UI nicety only.

## 4. `TicketSearchQuery` time range

- Extend `TicketSearchQuery` with `TimeRange`, consistent with `AlertHistoryQuery`/`IncidentSearchQuery`.
- **Consumer**: search-ai-archeology (era-bounded ticket queries; currently filters client-side and records over-fetch as a limitation).

## 5. `BaseGraphRunner` adoption

- Only `alert-ai-tuner` extends `BaseGraphRunner` (Zod-validated input contracts); the other 17 plugins implement `WorkflowRunner` directly. Migrate them to `BaseGraphRunner` so frontend/backed contracts are schema-enforced uniformly (strong typing goal for frontend plugin contracts).

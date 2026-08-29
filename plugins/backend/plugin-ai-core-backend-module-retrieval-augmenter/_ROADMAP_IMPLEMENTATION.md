# Retrieval Augmenter Module — Aggregated Roadmap Items

No blocking items reported by the 18 agentic workflow plugins. `knowledge.retrieve` + `DefaultRetrievalPipeline` are consumed as-is across the suite (entity/incident-scoped filters, capped chunk counts, and byte-identical outputs with retrieval enabled/disabled where plans require isolation).

## Watch items (not blockers)

- Keep retrieval strictly advisory: multiple plans require that retrieval output never sets verdicts, thresholds, ratios, or parameter values (guardrail-agent, tech-radar, infra, intent). Preserve the pure-code decision paths when evolving the pipeline.
- If `listArtifacts(filter)` lands in core (see `plugin-ai-core-backend`), trend-oriented agents may shift some history reads off checkpoints; no retrieval-augmenter change required.

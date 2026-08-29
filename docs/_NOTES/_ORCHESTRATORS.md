1. ### 1. __`SingleShotOrchestrator`__

   - __Used by__: `service‑contextualizer` (the default fallback agent)

   - __Usage scenario__: Only invoked when:

     1. A trigger/webhook request arrives without an `agentId` AND without a trigger‑specific `agentId`
     2. The runtime selects the default agent (`service‑contextualizer`)
     3. Since `service‑contextualizer` has no `workflowRef`, it falls back to its `orchestrator: 'single‑shot'`

   - __Reality__: All 18 plugins register triggers with explicit `agentId`, so this path is likely never taken in production.

   ### 2. __`CrewOrchestrator`__

   - __Used by__: `doc‑janitor‑crew` (example crew agent)
   - __Usage scenario__: Never invoked. `doc‑janitor‑crew` exists purely as an example and is not referenced by any trigger, route, or plugin.
   - __Status__: Pure placeholder/demo code.

   ### 3. __`LangGraphOrchestrator`__

   - __Used by__: __No agent whatsoever__
   - __No agent__ (plugin or config) sets `orchestrator: 'langgraph'`
   - __Zero runtime usage__

   ### 4. __The 18 Agentic‑Workflow Plugins__

   - __Pattern__: Each defines its own `WorkflowRunner` (or `BaseGraphRunner`) with a unique `workflowRef`
   - __Agent definitions__: All include `workflowRef: '<plugin‑specific‑id>'` and __no `orchestrator` field__
   - __Runtime behavior__: When an agent has a `workflowRef`, `AgentRuntime.run` selects the registered workflow runner __and skips the built‑in orchestrators entirely__.

Recommendation:

__`BaseGraphRunner` adoption__: Migrate the other 17 plugins to extend `BaseGraphRunner` for consistent Zod‑based contract validation.
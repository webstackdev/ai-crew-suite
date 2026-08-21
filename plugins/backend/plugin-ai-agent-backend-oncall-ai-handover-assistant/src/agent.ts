/*
 * Copyright 2026 Webstack Builders, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
import type { AgentDefinition } from '@webstackbuilders/plugin-ai-core-node'; import type { OncallHandoverConfig } from './config';

/** Stable agent route identifier. */ export const ONCALL_HANDOVER_AGENT_ID='oncall-handover-assistant';
/** Read-only operational tools used to compile a handover brief. */ export const ONCALL_HANDOVER_TOOL_IDS=['incident.alert.history','incident.incident.list','incident.incident.get','incident.oncall.get','kubernetes.workload.get_timeline','kubernetes.workload.list_events','kubernetes.workload.get_snapshot','vcs.pull_request.list','project.ticket.search','project.ticket.get','knowledge.retrieve'] as const;
/** Evidence-only system prompt for the handover summarizer. */ export const ONCALL_HANDOVER_SYSTEM_PROMPT='Summarize only the supplied clustered signal bundle. Cite sig-N IDs for every statement. Rank active incidents, unresolved tickets, risky deployments, then noise. Say "no data available for this source" when absent. Never invent alert counts, PR authors, or ticket statuses.';
/** Creates the fresh-window, read-only handover agent definition. */ export const createOncallHandoverAgent=(config:OncallHandoverConfig):AgentDefinition=>({id:ONCALL_HANDOVER_AGENT_ID,modelRef:config.modelRef,workflowRef:'oncall-handover',memory:'none',systemPrompt:ONCALL_HANDOVER_SYSTEM_PROMPT,toolIds:[...ONCALL_HANDOVER_TOOL_IDS],triggers:[{id:'oncall-handover-on-demand',source:'manual',agentId:ONCALL_HANDOVER_AGENT_ID},{id:'oncall-handover-shift-change',source:'scheduler',agentId:ONCALL_HANDOVER_AGENT_ID}]});

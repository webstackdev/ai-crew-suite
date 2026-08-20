import type { AgentDefinition } from '@webstackbuilders/plugin-ai-core-node';
import type { KubernetesAiResponderConfig } from './config';
import { KUBERNETES_INCIDENT_TRIAGE_WORKFLOW_ID } from './workflow/IncidentTriageGraph';

export const KUBERNETES_AI_RESPONDER_AGENT_ID = 'kubernetes-ai-responder';

/**
 * Read-only tool allow-list for the responder. VCS, observability, and
 * knowledge tools are added only after their shared evidence execution
 * contracts are available; no write-capable tool is ever listed here.
 */
export const KUBERNETES_AI_RESPONDER_TOOL_IDS = [
  'kubernetes.workload.resolve',
  'kubernetes.workload.get_snapshot',
  'kubernetes.pod.get_snapshot',
  'kubernetes.pod.get_logs',
  'kubernetes.workload.list_events',
  'kubernetes.workload.get_timeline',
] as const;

export const KUBERNETES_AI_RESPONDER_SYSTEM_PROMPT =
  'Investigate Kubernetes incidents using only the supplied evidence bundle. ' +
  'State uncertainty explicitly, prefer "insufficient evidence" over ' +
  'speculation, cite evidence IDs for every claim, and never propose ' +
  'unapproved mutations.';

/**
 * Builds the agent definition registered with AI Core for the responder.
 */
export const createKubernetesAiResponderAgent = (
  config: KubernetesAiResponderConfig,
): AgentDefinition => ({
  id: KUBERNETES_AI_RESPONDER_AGENT_ID,
  modelRef: config.modelRef,
  workflowRef: KUBERNETES_INCIDENT_TRIAGE_WORKFLOW_ID,
  systemPrompt: KUBERNETES_AI_RESPONDER_SYSTEM_PROMPT,
  toolIds: [...KUBERNETES_AI_RESPONDER_TOOL_IDS],
  memory: 'session',
  triggers: [
    {
      id: 'kubernetes-incident-webhook',
      source: 'alertmanager',
      agentId: KUBERNETES_AI_RESPONDER_AGENT_ID,
    },
  ],
});

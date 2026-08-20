import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import {
  agentExtensionPoint,
  triggerExtensionPoint,
  workflowRunnerExtensionPoint,
} from '@webstackbuilders/plugin-ai-core-node';
import { createKubernetesAiResponderAgent } from './agent';
import { readKubernetesAiResponderConfig } from './config';
import { IncidentTriageGraph } from './workflow/IncidentTriageGraph';

export const kubernetesAiResponderModule = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'agent-kubernetes-ai-responder',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        agents: agentExtensionPoint,
        triggers: triggerExtensionPoint,
        workflows: workflowRunnerExtensionPoint,
      },
      async init({ config, logger, agents, triggers, workflows }) {
        const responderConfig = readKubernetesAiResponderConfig(config);
        workflows.registerRunner(
          new IncidentTriageGraph({
            maxEvidenceItems: responderConfig.maxEvidenceItems,
            maxLogBytes: responderConfig.maxLogBytes,
            lookbackMinutes: responderConfig.lookbackMinutes,
            maxToolInvocations: responderConfig.maxToolInvocations,
          }),
        );
        const agent = createKubernetesAiResponderAgent(responderConfig);
        agents.addAgent(agent);
        for (const trigger of agent.triggers ?? []) {
          triggers.addTrigger(trigger);
        }
        logger.info('Registered Kubernetes AI responder workflow');
      },
    });
  },
});

export default kubernetesAiResponderModule;

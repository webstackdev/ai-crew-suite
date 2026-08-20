import { Config } from '@backstage/config';

export type KubernetesAiResponderConfig = {
  modelRef: string;
  maxEvidenceItems: number;
  maxLogBytes: number;
  lookbackMinutes: number;
  maxToolInvocations: number;
};

export const readKubernetesAiResponderConfig = (
  config: Config,
): KubernetesAiResponderConfig => {
  const section = config.getOptionalConfig('ai.agents.kubernetesAiResponder');
  if (!section) {
    throw new Error(
      'Kubernetes AI responder requires ai.agents.kubernetesAiResponder configuration to be set',
    );
  }

  return {
    modelRef: section.getString('model'),
    maxEvidenceItems: section.getOptionalNumber('maxEvidenceItems') ?? 20,
    maxLogBytes: section.getOptionalNumber('maxLogBytes') ?? 16_384,
    lookbackMinutes: section.getOptionalNumber('lookbackMinutes') ?? 30,
    maxToolInvocations: section.getOptionalNumber('maxToolInvocations') ?? 12,
  };
};

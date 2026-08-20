export interface Config {
  ai?: {
    agents?: {
      kubernetesAiResponder?: {
        model: string;
        maxEvidenceItems?: number;
        maxLogBytes?: number;
        lookbackMinutes?: number;
        maxToolInvocations?: number;
      };
    };
  };
}

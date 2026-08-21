export interface Config {
  ai?: {
    agents?: {
      catalogAiInsights?: {
        model: string;
        maxContextItems?: number;
        maxRetrievalChunks?: number;
        maxLogResults?: number;
        maxToolInvocations?: number;
        lookbackMinutes?: number;
        scan?: {
          enabled?: boolean;
          cron?: string;
          maxScanEntities?: number;
        };
      };
    };
  };
}

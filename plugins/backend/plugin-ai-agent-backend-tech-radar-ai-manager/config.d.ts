export interface Config { ai?: { agents?: { techRadarManager?: { model: string; radar: { sourceUrl: string }; maxToolInvocations?: number; thresholds?: { assessToTrialRatio?: number } } } } }

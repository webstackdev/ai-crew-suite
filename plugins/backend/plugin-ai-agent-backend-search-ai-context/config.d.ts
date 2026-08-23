export interface Config { ai?: { agents?: { searchContext?: { model: string; maxDepth?: number; maxConsumers?: number; maxToolInvocations?: number; capableProviders?: string[] } } } }

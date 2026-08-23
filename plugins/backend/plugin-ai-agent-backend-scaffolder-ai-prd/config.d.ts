export interface Config { ai?: { agents?: { scaffolderPrd?: { model: string; maxPrdChars?: number; maxStories?: number; templates: { allowed: string[] }; execute?: { enabled?: boolean } } } } }

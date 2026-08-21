/*
 * Copyright 2026 Webstack Builders, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
import type { AgentEvent } from '@webstackbuilders/plugin-ai-core-node'; import type { HandoverBrief } from '../workflow/state';

/** Artifact kind emitted for a finalized shift handover brief. */ export const ONCALL_HANDOVER_BRIEF_ARTIFACT_KIND='oncall-handover-brief';
/** Creates the replayable artifact event carrying the serialized handover brief. */ export const createHandoverBriefArtifactEvent=(runId:string,brief:HandoverBrief):AgentEvent=>({type:'artifact',data:{runId,kind:ONCALL_HANDOVER_BRIEF_ARTIFACT_KIND,ref:JSON.stringify(brief)}});

/*
 * Copyright 2024 Larder Software Limited
 * Copyright 2026 Webstack Builders, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { createApiRef } from '@backstage/core-plugin-api';
import {
  AiAgentSummary,
  AiRunEvent,
  AiRunInput,
  RunApprovalInput,
  RunStartOptions,
} from '../@types';

export interface RagAiApi {
  listAgents(): Promise<AiAgentSummary[]>;
  startRun(
    agentId: string,
    input: AiRunInput,
    opts?: RunStartOptions,
  ): AsyncGenerator<AiRunEvent>;
  streamRunEvents(runId: string, lastEventId?: number): AsyncGenerator<AiRunEvent>;
  approveRun(runId: string, decision: RunApprovalInput): AsyncGenerator<AiRunEvent>;
}

export const ragAiApiRef = createApiRef<RagAiApi>({
  id: 'plugin.ai-core.api',
});

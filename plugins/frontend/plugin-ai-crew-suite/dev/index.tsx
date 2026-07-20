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
import React from 'react';
import { createDevApp } from '@backstage/dev-utils';
import { createApiFactory } from '@backstage/core-plugin-api';
import {
  ragAiPlugin,
  RagModal,
  SidebarRagModal,
} from '../src/plugin';
import {
  type AiAgentSummary,
  type AiRunInput,
  type RunStartOptions,
  type AiRunEvent,
  type RunApprovalInput
} from '../src/@types';
import {
  type RagAiApi,
  ragAiApiRef,
} from '../src/api/ragApi';

class MockRagAiClient implements RagAiApi {
  async listAgents(): Promise<AiAgentSummary[]> {
    return [
      {
        id: 'spotify-helper-agent',
        orchestrator: 'crew',
        memory: 'session',
        tools: ['catalog-reader', 'scaffolder-executor']
      },
      {
        id: 'roadie-rag-agent',
        orchestrator: 'single-shot',
        memory: 'none',
        tools: ['docs-search']
      }
    ];
  }

  async *startRun(
    agentId: string,
    input: AiRunInput,
    opts?: RunStartOptions,
  ): AsyncGenerator<AiRunEvent> {
    yield {
      type: 'step',
      data: { runId: 'mock-run-id', seq: 1, node: agentId, phase: 'enter' }
    };
    yield {
      type: 'token',
      data: { runId: 'mock-run-id', text: `Processing your query: ${input.query}` }
    };
  }

  async *streamRunEvents(runId: string, lastEventId?: number): AsyncGenerator<AiRunEvent> {
    yield {
      type: 'token',
      data: { runId, text: 'Resuming streaming tokens down to layout panel...' }
    };
    yield {
      type: 'done',
      data: { runId }
    };
  }

  async *approveRun(runId: string, decision: RunApprovalInput): AsyncGenerator<AiRunEvent> {
    yield {
      type: 'approval_request',
      data: {
        runId,
        approvalId: 'mock-approval-id',
        reason: decision.note ?? `Action evaluated: ${decision.status}`,
        effect: 'write'
      }
    };
    yield {
      type: 'done',
      data: { runId }
    };
  }
}

createDevApp()
  // 2. Register your mock API factory
  .registerApi(
    createApiFactory({
      api: ragAiApiRef,
      deps: {},
      factory: () => new MockRagAiClient(),
    }),
  )
  .registerPlugin(ragAiPlugin)
  .addRootChild(<SidebarRagModal />)
  .addPage({
    element: <RagModal />,
    title: 'RAG AI Modal',
    path: '/rag-ai',
  })
  .render();

/*
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

import { ConfigApi, DiscoveryApi, FetchApi, IdentityApi } from '@backstage/core-plugin-api';

export interface BaseAiAgentClientOptions {
  configApi: ConfigApi;
  discoveryApi: DiscoveryApi;
  fetchApi: FetchApi;
  identityApi: IdentityApi;
}

/** Standard AI Core SSE events understood by frontend UI. */
export interface AiStepEvent {
  type: 'step';
  data: { runId: string; seq: number; node: string; phase: 'enter' | 'exit' };
}

export interface AiToolCallEvent {
  type: 'tool_call';
  data: { runId: string; tool: string; args: unknown };
}

export interface AiToolResultEvent {
  type: 'tool_result';
  data: { runId: string; tool: string; ok: boolean; summary?: string };
}

export interface AiApprovalRequestEvent {
  type: 'approval_request';
  data: { runId: string; approvalId: string; reason: string; effect: 'read' | 'write' };
}

export interface AiArtifactEvent {
  type: 'artifact';
  data: { runId: string; kind: string; ref?: string; url?: string };
}

export interface AiDoneEvent {
  type: 'done';
  data: { runId: string };
}

export interface AiErrorEvent {
  type: 'error';
  data: { runId: string; message: string };
}

/** The Master Union containing every possible agent stream event */
export type MasterAiRunEvent =
  | AiStepEvent
  | AiToolCallEvent
  | AiToolResultEvent
  | AiApprovalRequestEvent
  | AiArtifactEvent
  | AiDoneEvent
  | AiErrorEvent;

/**
 * A reusable Generic utility that filters the master union by a union of its 'type' string literals.
 */
export type PickAiEvents<T extends MasterAiRunEvent['type']> = Extract<MasterAiRunEvent, { type: T }>;

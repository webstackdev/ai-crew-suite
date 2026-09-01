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

/** Structured, queryable token-usage record (replaces usage-as-unstructured-step-JSON). */
export type UsageRecord = {
  runId: string;
  agentId: string;
  workflowRef: string;
  node?: string;
  modelRef: string;
  input: number;
  output: number;
  total: number;
  createdAt: string;
};

/** Filter for reading back usage records. All fields optional. */
export type UsageFilter = {
  runId?: string;
  agentId?: string;
  workflowRef?: string;
  modelRef?: string;
  since?: string;
  until?: string;
};

/** Sink + reader for structured token usage (cost monitoring). */
export interface UsageSink {
  record(entry: UsageRecord): Promise<void>;
  list(filter: UsageFilter): Promise<UsageRecord[]>;
}

/** A vector-store provider registration (replaces LLM modules hard-coding stores). */
export type VectorStoreDefinition = {
  id: string;
  store: unknown;
};

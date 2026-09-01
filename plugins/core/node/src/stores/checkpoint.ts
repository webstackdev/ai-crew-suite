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

import type { AgentEvent } from '../events/agentEvent';

/**
 * Persisted snapshot of workflow state at a graph position. Append-only; never overwritten.
 * Only the `state` blob is sensitive; routing metadata stays readable for resume/retention.
 */
export type CheckpointRecord = {
  runId: string;
  /** Monotonic checkpoint number within the run. */
  seq: number;
  /** Graph node the graph will enter next (absent = complete). */
  nextNode?: string;
  /** Zod-validated, versioned workflow state snapshot. */
  state: unknown;
  stateVersion: number;
  /** Pending interrupt payload when the graph is paused for approval. */
  pendingApproval?: { approvalId: string; node: string; reason: string };
  createdAt: string;
};

/**
 * Store for resumable orchestration state. Append-only; `put` is idempotent on (runId, seq)
 * so executor retries cannot double-write.
 */
export interface CheckpointStore {
  put(record: CheckpointRecord): Promise<void>;
  getLatest(runId: string): Promise<CheckpointRecord | undefined>;
  list(runId: string): Promise<CheckpointRecord[]>;
  delete(runId: string): Promise<void>;
}

/**
 * Wire format a checkpoint takes when persisted. Only `payload` is opaque (ciphertext when
 * an encrypting serializer is registered, JSON otherwise). Metadata columns stay readable.
 */
export type PersistedCheckpoint = {
  runId: string;
  seq: number;
  payload: Uint8Array | string;
  serializerId: string;
  nextNode?: string;
  stateVersion: number;
  createdAt: string;
};

/**
 * Transforms a checkpoint record to/from its persisted representation. The default is
 * pass-through JSON; an enterprise supplies an encrypting implementation (e.g. KMS envelope)
 * via `runtimeStoreExtensionPoint.setStateSerializer`. The engine is unaware of it.
 */
export interface StateSerializer {
  readonly serializerId: string;
  serialize(record: CheckpointRecord): Promise<PersistedCheckpoint>;
  deserialize(record: PersistedCheckpoint): Promise<CheckpointRecord>;
}

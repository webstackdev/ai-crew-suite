/*
 * Copyright 2024 Larder Software Limited
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
import { Knex } from 'knex';
import {
  ApprovalDecision,
  ApprovalRequest,
  Artifact,
  ArtifactSink,
  CheckpointStore,
  RunRecord,
  RunStore,
  SessionMessage,
  SessionStore,
} from '@webstackbuilders/plugin-ai-core-node';
import { randomUUID } from 'crypto';

export class PgAgentRuntimeStore
  implements SessionStore, CheckpointStore, RunStore, ArtifactSink
{
  constructor(private readonly client: Knex) {}

  async createSession(agentId: string, userRef?: string): Promise<string> {
    const id = randomUUID();
    await this.client('ai_sessions').insert({
      id,
      agent_id: agentId,
      user_ref: userRef ?? null,
      metadata: JSON.stringify({}),
    });
    return id;
  }

  async appendMessage(sessionId: string, message: SessionMessage): Promise<void> {
    await this.client('ai_messages').insert({
      id: randomUUID(),
      session_id: sessionId,
      role: message.role,
      content: message.content,
      token_usage: message.tokenUsage ? JSON.stringify(message.tokenUsage) : null,
    });
  }

  async listMessages(sessionId: string, limit = 20): Promise<SessionMessage[]> {
    const rows = await this.client('ai_messages')
      .select('role', 'content', 'token_usage', 'created_at')
      .where({ session_id: sessionId })
      .orderBy('created_at', 'asc')
      .limit(limit);

    return rows.map(row => ({
      role: row.role,
      content: row.content,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
      tokenUsage: row.token_usage
        ? JSON.parse(typeof row.token_usage === 'string' ? row.token_usage : '{}')
        : undefined,
    }));
  }

  async save(runId: string, state: unknown): Promise<void> {
    await this.client('ai_checkpoints')
      .insert({
        run_id: runId,
        state: JSON.stringify(state),
      })
      .onConflict('run_id')
      .merge({
        state: JSON.stringify(state),
        updated_at: this.client.fn.now(),
      });
  }

  async load<T = unknown>(runId: string): Promise<T | undefined> {
    const row = await this.client('ai_checkpoints')
      .select('state')
      .where({ run_id: runId })
      .first();

    if (!row) {
      return undefined;
    }

    if (typeof row.state === 'string') {
      return JSON.parse(row.state) as T;
    }

    return row.state as T;
  }

  async createRun(record: RunRecord): Promise<void> {
    await this.client('ai_runs').insert({
      id: record.id,
      agent_id: record.agentId,
      session_id: record.sessionId ?? null,
      status: record.status,
      trigger: record.trigger ?? null,
      idempotency_key: record.idempotencyKey ?? null,
    });
  }

  async getRun(runId: string): Promise<RunRecord | undefined> {
    const row = await this.client('ai_runs')
      .select('id', 'agent_id', 'session_id', 'status', 'trigger', 'idempotency_key')
      .where({ id: runId })
      .first();

    if (!row) {
      return undefined;
    }

    return {
      id: row.id,
      agentId: row.agent_id,
      sessionId: row.session_id ?? undefined,
      status: row.status,
      trigger: row.trigger ?? undefined,
      idempotencyKey: row.idempotency_key ?? undefined,
    };
  }

  async findRunByIdempotencyKey(key: string): Promise<RunRecord | undefined> {
    const row = await this.client('ai_runs')
      .select('id', 'agent_id', 'session_id', 'status', 'trigger', 'idempotency_key')
      .where({ idempotency_key: key })
      .first();

    if (!row) {
      return undefined;
    }

    return {
      id: row.id,
      agentId: row.agent_id,
      sessionId: row.session_id ?? undefined,
      status: row.status,
      trigger: row.trigger ?? undefined,
      idempotencyKey: row.idempotency_key ?? undefined,
    };
  }

  async updateRunStatus(runId: string, status: RunRecord['status']): Promise<void> {
    await this.client('ai_runs')
      .where({ id: runId })
      .update({
        status,
        ended_at: status === 'running' ? null : this.client.fn.now(),
      });
  }

  async appendRunStep(
    runId: string,
    seq: number,
    type: string,
    payload: unknown,
  ): Promise<void> {
    await this.client('ai_run_steps').insert({
      id: randomUUID(),
      run_id: runId,
      seq,
      type,
      payload: JSON.stringify(payload),
    });
  }

  async createApproval(request: ApprovalRequest): Promise<void> {
    await this.client('ai_approvals').insert({
      id: request.id,
      run_id: request.runId,
      status: 'pending',
      note: request.reason,
    });
  }

  async getPendingApproval(runId: string): Promise<ApprovalRequest | undefined> {
    const row = await this.client('ai_approvals')
      .select('id', 'run_id', 'status', 'note')
      .where({ run_id: runId, status: 'pending' })
      .orderBy('requested_at', 'desc')
      .first();

    if (!row) {
      return undefined;
    }

    return {
      id: row.id,
      runId: row.run_id,
      reason: row.note ?? 'Approval required',
      effect: 'write',
    };
  }

  async decideApproval(runId: string, decision: ApprovalDecision): Promise<void> {
    await this.client('ai_approvals')
      .where({ run_id: runId, status: 'pending' })
      .update({
        status: decision.status,
        note: decision.note ?? null,
        decided_at: this.client.fn.now(),
        decided_by: decision.decidedBy ?? null,
      });
  }

  async record(artifact: Artifact): Promise<void> {
    await this.client('ai_artifacts').insert({
      id: artifact.id,
      run_id: artifact.runId,
      kind: artifact.kind,
      ref: artifact.ref ?? null,
      url: artifact.url ?? null,
    });
  }
}

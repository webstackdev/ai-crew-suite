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
  CheckpointStore,
  SessionMessage,
  SessionStore,
} from '@webstackbuilders/plugin-ai-core-node';
import { randomUUID } from 'crypto';

export class PgAgentRuntimeStore implements SessionStore, CheckpointStore {
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
}

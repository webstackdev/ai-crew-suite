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
import type { VectorStore } from '@webstackbuilders/plugin-ai-core-node';
import { applyDatabaseMigrations } from '../database/migrations';
import { PgVectorStore } from './PgVectorStore';
import { PgAgentRuntimeStore } from './PgAgentRuntimeStore';
import type { PgVectorStoreInitConfig, PgVectorStoreOptions } from '../@types';

/**
 * Creates the pgvector-backed vector store used by indexing and retrieval.
 *
 * The factory obtains the Backstage database client, applies the packaged
 * pgvector migrations, reads optional `ai.storage.pgVector` tuning values, and
 * returns a configured `VectorStore` implementation.
 */
export async function createPgVectorStore({
  logger,
  database,
  config,
}: PgVectorStoreInitConfig): Promise<VectorStore> {
  logger.info('Starting PgVectorStore');

  const dbClient = await database.getClient();
  await applyDatabaseMigrations(dbClient);

  const pgVectorConfig = config.getOptionalConfig('ai.storage.pgVector');
  const options: PgVectorStoreOptions = {};
  if (pgVectorConfig) {
    options.amount = pgVectorConfig.getOptionalNumber('amount');
    options.chunkSize = pgVectorConfig.getOptionalNumber('chunkSize');
  }

  return PgVectorStore.initialize({
    logger,
    db: dbClient,
    chunkSize: options?.chunkSize,
    amount: options?.amount,
  });
}

/**
 * Creates the pgvector-backed runtime store for sessions, runs, and audit data.
 *
 * The runtime store shares the same migration path as the vector store so a
 * module can safely wire either or both stores during backend startup.
 */
export async function createPgAgentRuntimeStore({
  logger,
  database,
}: Omit<PgVectorStoreInitConfig, 'config'>): Promise<PgAgentRuntimeStore> {
  logger.info('Starting PgAgentRuntimeStore');
  const dbClient = await database.getClient();
  await applyDatabaseMigrations(dbClient);
  return new PgAgentRuntimeStore(dbClient);
}

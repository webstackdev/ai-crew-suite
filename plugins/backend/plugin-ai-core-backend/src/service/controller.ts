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

import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { LoggerService } from '@backstage/backend-plugin-api';
import { NotAllowedError } from '@backstage/errors';
import {
  AgentDefinition,
  AgentEvent,
  ApprovalDecision,
  AuditLogSink,
  ArtifactSink,
  CheckpointStore,
  EntityFilterShape,
  EmbeddingsSource,
  RetrievalPipeline,
  RunStore,
  SessionStore,
  ToolRegistry,
  TriggerBinding,
} from '@webstackbuilders/plugin-ai-core-node';
import { AgentRuntime } from '../runtime/AgentRuntime';
import type { HardeningOptions } from '../@types';

/**
 * HTTP controller for AI backend endpoints.
 *
 * Bridges express routes to runtime execution, embeddings management, SSE
 * streaming, and approval handling. Identity and authorization are enforced
 * at this boundary.
 */
export class AiCoreController {
  private readonly runtime: AgentRuntime;
  private readonly toolRegistry: ToolRegistry;
  private readonly augmentationIndexer: AugmentationIndexer;
  private readonly retrievalPipeline?: RetrievalPipeline;
  private readonly agents: Map<string, AgentDefinition>;
  private readonly sessionStore?: SessionStore;
  private readonly checkpointStore?: CheckpointStore;
  private readonly runStore?: RunStore;
  private readonly artifactSink?: ArtifactSink;
  private readonly auditLogSink?: AuditLogSink;
  private readonly triggers: TriggerBinding[];
  private readonly hardening: HardeningOptions;
  private readonly rateLimitBucket = new Map<string, number[]>();
  private logger: LoggerService;

  constructor(
    logger: LoggerService,
    runtime: AgentRuntime,
    toolRegistry: ToolRegistry,
    augmentationIndexer: AugmentationIndexer,
    agents: Map<string, AgentDefinition>,
    retrievalPipeline?: RetrievalPipeline,
    sessionStore?: SessionStore,
    checkpointStore?: CheckpointStore,
    runStore?: RunStore,
    artifactSink?: ArtifactSink,
    auditLogSink?: AuditLogSink,
    triggers: TriggerBinding[] = [],
    hardening: HardeningOptions = {},
  ) {
    this.logger = logger;
    this.runtime = runtime;
    this.toolRegistry = toolRegistry;
    this.augmentationIndexer = augmentationIndexer;
    this.retrievalPipeline = retrievalPipeline;
    this.agents = agents;
    this.sessionStore = sessionStore;
    this.checkpointStore = checkpointStore;
    this.runStore = runStore;
    this.artifactSink = artifactSink;
    this.auditLogSink = auditLogSink;
    this.triggers = triggers;
    this.hardening = hardening;
  }

  private isAuthenticated(req: Request): boolean {
    return Boolean((req as unknown as { user?: { identity?: { userEntityId?: string } } }).user?.identity?.userEntityId);
  }

  private identity(req: Request, fallback: string): string {
    const identity = (req as unknown as { user?: { identity?: { userEntityId?: string } } }).user?.identity?.userEntityId;
    if (!identity) {
      throw new NotAllowedError('Unauthenticated request: no verified UserRef available');
    }
    return identity;

  createEmbeddings = async (req: Request, res: Response) => {
    if (!this.isAuthenticated(req)) {
      return res.status(401).send({ message: 'Unauthorized' });
    }
    const { query, source, entityFilter } = req.body ?? {};
    if (!query || typeof query !== 'string') {
      return res.status(422).send({ message: 'input.query is required' });
    }
    const safeSource = this.validateSource(source);
    this.logger.info(`Creating embeddings for source ${safeSource}`);
    await this.augmentationIndexer.createEmbeddings(safeSource, { entityFilter } as { entityFilter?: EntityFilterShape });
    this.logger.info(`Created embeddings for source ${safeSource}`);
    return res.status(201).send({ response: `Embeddings created for source ${safeSource}` });
  };

  deleteEmbeddings = async (req: Request, res: Response) => {
    if (!this.isAuthenticated(req)) {
      return res.status(401).send({ message: 'Unauthorized' });
    }
    const { source, entityFilter } = req.body ?? {};
    if (!source || typeof source !== 'string') {
      return res.status(422).send({ message: 'input.source is required' });
    }
    const safeSource = this.validateSource(source);
    this.logger.info(`Deleting embeddings for source ${safeSource}`);
    await this.augmentationIndexer.deleteEmbeddings(safeSource, { entityFilter } as { entityFilter?: EntityFilterShape });
    this.logger.info(`Deleted embeddings for source ${safeSource}`);
    return res.status(201).send({ response: `Embeddings deleted for source ${safeSource}` });
  };

  getEmbeddings = async (req: Request, res: Response) => {
    if (!this.isAuthenticated(req)) {
      return res.status(401).send({ message: 'Unauthorized' });
    }
    const { query, source, entityFilter } = req.query ?? {};
    if (!query || typeof query !== 'string') {
      return res.status(422).send({ message: 'query query param is required' });
    }
    const safeSource = this.validateSource(source as string | undefined);
    const results = await this.augmentationIndexer.getEmbeddings(safeSource, query, { entityFilter } as { entityFilter?: unknown });
    return res.status(200).send({ results });
  };

  listAgents = async (req: Request, res: Response) => {
    if (!this.isAuthenticated(req)) {
      return res.status(401).send({ message: 'Unauthorized' });
    }
    const items = [...this.agents.values()].map(agent => ({ id: agent.id, workflowRef: agent.workflowRef }));
    return res.status(200).send({ agents: items });
  };

  startRun = async (req: Request, res: Response) => {
    if (!this.isAuthenticated(req)) {
      return res.status(401).send({ message: 'Unauthorized' });
    }
    const agentId = req.params.id;
    const agent = this.agents.get(agentId);
    if (!agent) {
      return res.status(422).send({ message: `Unknown agent '${agentId}'` });
    }
    const payload = req.body?.input ?? req.body ?? {};
    const query = this.normalizeQuery(payload.query);
    if (!query) {
      return res.status(422).send({ message: 'input.query is required' });
    }
    if (!this.consumeRateLimit(agent.id)) {
      this.logger.warn(`Rate limit exceeded for agent '${agent.id}'`);
      return res.status(429).send({ message: 'Rate limit exceeded for agent' });
    }
    return res.end();
  };

  streamRunEvents = async (req: Request, res: Response) => {
    if (!this.isAuthenticated(req)) {
      return res.status(401).send({ message: 'Unauthorized' });
    }
    const runId = req.params.id;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
    });
    const sinceSeq = this.parseLastEventId(req.header('last-event-id'));
    const steps = (await this.runStore?.listRunSteps(runId, sinceSeq)) ?? [];
    for (const step of steps) {
      const event = this.fromStoredStep(step.type, step.payload);
      if (event) {
        this.writeEvent(res, event, step.seq);
        res.flush?.();
      }
    }
    return res.end();
  };

  approveRun = async (req: Request, res: Response) => {
    if (!this.isAuthenticated(req)) {
      return res.status(401).send({ message: 'Unauthorized' });
    }
    return res.end();
  };

  triggerRun = async (req: Request, res: Response) => {
    if (!this.isAuthenticated(req)) {
      return res.status(401).send({ message: 'Unauthorized' });
    }
    return res.status(501).send({ message: 'Trigger dispatch deferred during greenfield rebuild' });
  };

  webhookRun = async (req: Request, res: Response) => {
    if (!this.isAuthenticated(req)) {
      return res.status(401).send({ message: 'Unauthorized' });
    }
    return res.status(501).send({ message: 'Webhook dispatch deferred during greenfield rebuild' });
  };

  private validateSource(source: string | undefined): EmbeddingsSource {
    if (!source || typeof source !== 'string' || source === 'all') {
      return 'all' as EmbeddingsSource;
    }
    return source as EmbeddingsSource;
  }

  private normalizeQuery(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const query = value.trim();
    return query.length > 0 ? query : undefined;
  }

  private consumeRateLimit(agentId: string): boolean {
    const limit = this.hardening.rateLimitPerMinute;
    if (!limit || limit <= 0) return true;
    const now = Date.now();
    const cutoff = now - 60_000;
    const bucket = this.rateLimitBucket.get(agentId) ?? [];
    const nextBucket = bucket.filter(timestamp => timestamp >= cutoff);
    if (nextBucket.length >= limit) {
      this.rateLimitBucket.set(agentId, nextBucket);
      return false;
    }
    nextBucket.push(now);
    this.rateLimitBucket.set(agentId, nextBucket);
    return true;
  }

  private parseLastEventId(value?: string): number {
    if (!value) return 0;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  private fromStoredStep(type: string, payload: unknown): AgentEvent | undefined {
    const allowedTypes = ['step', 'token', 'tool_call', 'tool_result', 'usage', 'approval_request', 'artifact', 'done', 'error'] as const;
    if (allowedTypes.includes(type as never)) {
      return { type, data: payload as never } as AgentEvent;
    }
    return undefined;
  }

  private writeEvent = (res: Response, event: AgentEvent, seq?: number): void => {
    if (typeof seq === 'number') {
      res.write(`id: ${seq}\n`);
    }
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event.data)}\n\n`);
  };
}
  }
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
import { Request, Response } from 'express';
import { LoggerService } from '@backstage/backend-plugin-api';
import {
  AgentDefinition,
  AgentEvent,
  ApprovalDecision,
  AuditLogSink,
  ArtifactSink,
  AugmentationIndexer,
  CheckpointStore,
  EntityFilterShape,
  EmbeddingsSource,
  RetrievalPipeline,
  RunStore,
  SessionStore,
  ToolRegistry,
  TriggerBinding,
} from '@webstackbuilders/plugin-ai-core-node';
import { BaseLLM } from '@langchain/core/language_models/llms';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { randomUUID } from 'crypto';
import { AgentRuntime } from './AgentRuntime';
// For Response.flush()
// @ts-ignore
import type compression from 'compression';

export class RagAiController {
  private readonly runtime: AgentRuntime;
  private readonly toolRegistry: ToolRegistry;
  private readonly augmentationIndexer: AugmentationIndexer;
  private readonly retrievalPipeline?: RetrievalPipeline;
  private readonly models: Map<string, BaseLLM | BaseChatModel>;
  private readonly agents: Map<string, AgentDefinition>;
  private readonly defaultAgentId: string;
  private readonly sessionStore?: SessionStore;
  private readonly checkpointStore?: CheckpointStore;
  private readonly runStore?: RunStore;
  private readonly artifactSink?: ArtifactSink;
  private readonly auditLogSink?: AuditLogSink;
  private readonly triggers: TriggerBinding[];
  private readonly hardening: {
    timeoutMs?: number;
    maxRetries?: number;
    retryBackoffMs?: number;
    maxTotalTokens?: number;
    rateLimitPerMinute?: number;
  };
  private readonly rateLimitBucket = new Map<string, number[]>();
  private logger: LoggerService;

  constructor(
    logger: LoggerService,
    runtime: AgentRuntime,
    toolRegistry: ToolRegistry,
    augmentationIndexer: AugmentationIndexer,
    models: Map<string, BaseLLM | BaseChatModel>,
    agents: Map<string, AgentDefinition>,
    defaultAgentId: string,
    retrievalPipeline?: RetrievalPipeline,
    sessionStore?: SessionStore,
    checkpointStore?: CheckpointStore,
    runStore?: RunStore,
    artifactSink?: ArtifactSink,
    auditLogSink?: AuditLogSink,
    triggers: TriggerBinding[] = [],
    hardening: {
      timeoutMs?: number;
      maxRetries?: number;
      retryBackoffMs?: number;
      maxTotalTokens?: number;
      rateLimitPerMinute?: number;
    } = {},
  ) {
    this.logger = logger;
    this.runtime = runtime;
    this.toolRegistry = toolRegistry;
    this.augmentationIndexer = augmentationIndexer;
    this.models = models;
    this.agents = agents;
    this.defaultAgentId = defaultAgentId;
    this.retrievalPipeline = retrievalPipeline;
    this.sessionStore = sessionStore;
    this.checkpointStore = checkpointStore;
    this.runStore = runStore;
    this.artifactSink = artifactSink;
    this.auditLogSink = auditLogSink;
    this.triggers = triggers;
    this.hardening = hardening;
  }

  listAgents = async (_req: Request, res: Response) => {
    return res.status(200).send({
      agents: [...this.agents.values()].map(agent => ({
        id: agent.id,
        orchestrator: agent.orchestrator ?? 'single-shot',
        memory: agent.memory ?? 'none',
        tools: agent.toolIds,
      })),
    });
  };

  createEmbeddings = async (req: Request, res: Response) => {
    const source = req.params.source as EmbeddingsSource;
    const entityFilter = req.body.entityFilter;

    this.logger.info(`Creating embeddings for source ${source}`);
    const amountOfEmbeddings = await this.augmentationIndexer.createEmbeddings(
      source,
      entityFilter,
    );
    return res.status(200).send({
      response: `${amountOfEmbeddings} embeddings created for source ${source}, for entities with filter ${JSON.stringify(
        entityFilter,
      )}`,
    });
  };

  getEmbeddings = async (req: Request, res: Response) => {
    if (!this.retrievalPipeline) {
      return res.status(500).send({
        message: 'No retrieval pipeline configured for this AI backend. ',
      });
    }

    const source = req.params.source as EmbeddingsSource;
    const query = req.query.query as string;
    const entityFilter = req.body.entityFilter;

    const response = await this.retrievalPipeline.retrieveAugmentationContext(
      query,
      source,
      entityFilter,
    );
    return res.status(200).send({ response });
  };

  deleteEmbeddings = async (req: Request, res: Response) => {
    const source = req.params.source as EmbeddingsSource;
    const entityFilter = req.body.entityFilter;
    await this.augmentationIndexer.deleteEmbeddings(source, entityFilter);
    return res
      .status(201)
      .send({ response: `Embeddings deleted for source ${source}` });
  };

  query = async (req: Request, res: Response) => {
    // TODO: Remove the need for source in query when we have magical abilities to create very good embeddings
    const source = req.params.source as EmbeddingsSource;
    const query = req.body.query;
    const entityFilter = req.body.entityFilter;
    const requestSessionId =
      typeof req.body.sessionId === 'string' && req.body.sessionId
        ? req.body.sessionId
        : undefined;
    const selectedAgentId =
      typeof req.body.agentId === 'string' && req.body.agentId
        ? req.body.agentId
        : this.defaultAgentId;
    const selectedAgent = this.agents.get(selectedAgentId);

    if (!selectedAgent) {
      res.status(422).send({
        message: `Unknown agent '${selectedAgentId}'`,
      });
      return;
    }

    const model = this.models.get(selectedAgent.modelRef);
    if (!model) {
      res.status(500).send({
        message: `Agent '${selectedAgent.id}' references unknown model '${selectedAgent.modelRef}'`,
      });
      return;
    }

    const runId = randomUUID();
    const sessionId =
      selectedAgent.memory === 'session' && this.sessionStore
        ? requestSessionId ??
          (await this.sessionStore.createSession(selectedAgent.id, 'anonymous'))
        : undefined;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
    });

    try {
      for await (const event of this.executeRun(
        {
          runId,
          agentId: selectedAgent.id,
          input: {
            query,
            source,
            sessionId,
            entityFilter,
          },
        },
        model,
        selectedAgent,
      )) {
        this.writeEvent(res, event);
        res.flush?.();
      }
    } catch (e: any) {
      this.writeEvent(res, {
        type: 'error',
        data: {
          runId,
          message: e?.message ?? 'Failed to run query',
        },
      });
      this.logger.error(
        `There was an error executing query ${query} for source ${source} on entity ${entityFilter}: ${e.message}`,
        e,
      );
    }

    res.end();
  };

  startRun = async (req: Request, res: Response) => {
    const agentId = req.params.id;
    const selectedAgent = this.agents.get(agentId);
    if (!selectedAgent) {
      return res.status(422).send({ message: `Unknown agent '${agentId}'` });
    }

    const model = this.models.get(selectedAgent.modelRef);
    if (!model) {
      return res.status(500).send({
        message: `Agent '${selectedAgent.id}' references unknown model '${selectedAgent.modelRef}'`,
      });
    }

    const payload = req.body?.input ?? req.body ?? {};
    const query = payload.query;
    const source = payload.source ?? 'all';
    const entityFilter = payload.entityFilter;
    const idempotencyKey = req.body?.idempotencyKey;

    if (!query || typeof query !== 'string') {
      return res.status(422).send({ message: 'input.query is required' });
    }

    if (!this.consumeRateLimit(selectedAgent.id)) {
      return res.status(429).send({ message: 'Rate limit exceeded for agent' });
    }

    if (idempotencyKey && this.runStore) {
      const existing = await this.runStore.findRunByIdempotencyKey(idempotencyKey);
      if (existing) {
        return res.status(200).send({
          duplicate: true,
          runId: existing.id,
          status: existing.status,
        });
      }
    }

    const runId = randomUUID();
    const sessionId =
      selectedAgent.memory === 'session' && this.sessionStore
        ? payload.sessionId ??
          (await this.sessionStore.createSession(selectedAgent.id, 'anonymous'))
        : undefined;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
    });

    try {
      const abortController = new AbortController();
      const timeoutHandle = this.createTimeout(abortController);
      this.attachAbortOnClose(req, res, abortController, timeoutHandle);
      for await (const event of this.executeRun(
        {
          runId,
          agentId: selectedAgent.id,
          idempotencyKey,
          trigger: req.body?.trigger,
          input: {
            query,
            source,
            sessionId,
            entityFilter,
          },
        },
        model,
        selectedAgent,
        abortController.signal,
      )) {
        this.writeEvent(res, event);
        res.flush?.();
      }
      clearTimeout(timeoutHandle);
    } catch (e: any) {
      this.writeEvent(res, {
        type: 'error',
        data: { runId, message: e?.message ?? 'Failed to start run' },
      });
    }

    return res.end();
  };

  approveRun = async (req: Request, res: Response) => {
    const runId = req.params.id;
    const decision = req.body as ApprovalDecision;
    if (!decision || (decision.status !== 'approved' && decision.status !== 'rejected')) {
      return res.status(422).send({ message: "status must be 'approved' or 'rejected'" });
    }

    const run = await this.runStore?.getRun(runId);
    if (!run) {
      return res.status(404).send({ message: `Run '${runId}' not found` });
    }

    const agent = this.agents.get(run.agentId);
    if (!agent) {
      return res.status(404).send({ message: `Agent '${run.agentId}' not found` });
    }

    const model = this.models.get(agent.modelRef);
    if (!model) {
      return res.status(500).send({
        message: `Agent '${agent.id}' references unknown model '${agent.modelRef}'`,
      });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
    });

    for await (const event of this.runtime.resume(runId, decision, {
      logger: this.logger,
      toolRegistry: this.toolRegistry,
      model,
      systemPrompt: agent.systemPrompt,
      identity: decision.decidedBy ?? 'anonymous',
      memory: agent.memory,
      sessionStore: this.sessionStore,
      checkpointStore: this.checkpointStore,
      runStore: this.runStore,
      artifactSink: this.artifactSink,
    })) {
      this.writeEvent(res, event);
      res.flush?.();
    }

    return res.end();
  };

  triggerRun = async (req: Request, res: Response) => {
    const source = req.params.source;
    const trigger = this.triggers.find(it => (it.source ?? it.id) === source);
    const agentId = req.body?.agentId ?? trigger?.agentId ?? trigger?.id ?? this.defaultAgentId;
    const idempotencyKey = req.body?.idempotencyKey;

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return res.status(422).send({ message: 'idempotencyKey is required' });
    }

    const existing = await this.runStore?.findRunByIdempotencyKey(idempotencyKey);
    if (existing) {
      return res.status(200).send({ duplicate: true, runId: existing.id, status: existing.status });
    }

    const selectedAgent = this.agents.get(agentId);
    if (!selectedAgent) {
      return res.status(422).send({ message: `Unknown agent '${agentId}'` });
    }

    const model = this.models.get(selectedAgent.modelRef);
    if (!model) {
      return res.status(500).send({
        message: `Agent '${selectedAgent.id}' references unknown model '${selectedAgent.modelRef}'`,
      });
    }

    const payload = req.body?.input ?? req.body ?? {};
    const query = payload.query;
    const requestSource = payload.source ?? source;
    const entityFilter = payload.entityFilter;

    if (!query || typeof query !== 'string') {
      return res.status(422).send({ message: 'input.query is required' });
    }

    if (!this.consumeRateLimit(selectedAgent.id)) {
      return res.status(429).send({ message: 'Rate limit exceeded for agent' });
    }

    const runId = randomUUID();
    const sessionId =
      selectedAgent.memory === 'session' && this.sessionStore
        ? payload.sessionId ??
          (await this.sessionStore.createSession(selectedAgent.id, 'anonymous'))
        : undefined;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
    });

    try {
      const abortController = new AbortController();
      const timeoutHandle = this.createTimeout(abortController);
      this.attachAbortOnClose(req, res, abortController, timeoutHandle);
      for await (const event of this.executeRun(
        {
          runId,
          agentId: selectedAgent.id,
          idempotencyKey,
          trigger: source,
          input: {
            query,
            source: requestSource,
            sessionId,
            entityFilter,
          },
        },
        model,
        selectedAgent,
        abortController.signal,
      )) {
        this.writeEvent(res, event);
        res.flush?.();
      }
      clearTimeout(timeoutHandle);
    } catch (e: any) {
      this.writeEvent(res, {
        type: 'error',
        data: { runId, message: e?.message ?? 'Failed to process trigger run' },
      });
    }

    return res.end();
  };

  private async *executeRun(
    runInput: {
      runId: string;
      agentId: string;
      idempotencyKey?: string;
      trigger?: string;
      input: {
        query: string;
        source: string;
        sessionId?: string;
        entityFilter?: EntityFilterShape;
      };
    },
    model: BaseLLM | BaseChatModel,
    selectedAgent: AgentDefinition,
    signal?: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    for await (const event of this.runtime.run(runInput, {
      logger: this.logger,
      toolRegistry: this.toolRegistry,
      model,
      systemPrompt: selectedAgent.systemPrompt,
      identity: 'anonymous',
      memory: selectedAgent.memory,
      sessionStore: this.sessionStore,
      checkpointStore: this.checkpointStore,
      runStore: this.runStore,
      artifactSink: this.artifactSink,
      auditLogSink: this.auditLogSink,
      hardening: {
        maxRetries: this.hardening.maxRetries,
        retryBackoffMs: this.hardening.retryBackoffMs,
        maxTotalTokens: this.hardening.maxTotalTokens,
      },
      signal,
    })) {
      yield event;
    }
  }

  private createTimeout(controller: AbortController): NodeJS.Timeout | undefined {
    if (!this.hardening.timeoutMs || this.hardening.timeoutMs <= 0) {
      return undefined;
    }

    return setTimeout(() => {
      controller.abort(new Error('Run timed out'));
    }, this.hardening.timeoutMs);
  }

  private attachAbortOnClose(
    req: Request,
    res: Response,
    controller: AbortController,
    timeout?: NodeJS.Timeout,
  ): void {
    const onClose = () => {
      if (!controller.signal.aborted) {
        controller.abort(new Error('Client disconnected'));
      }
      if (timeout) {
        clearTimeout(timeout);
      }
      req.off('close', onClose);
      res.off('close', onClose);
    };

    req.on('close', onClose);
    res.on('close', onClose);
  }

  private consumeRateLimit(agentId: string): boolean {
    const limit = this.hardening.rateLimitPerMinute;
    if (!limit || limit <= 0) {
      return true;
    }

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

  private writeEvent = (res: Response, event: AgentEvent): void => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event.data)}\n\n`);

    // Compatibility aliases for existing frontend consumers during migration.
    if (event.type === 'token') {
      const lines = event.data.text.split('\n');
      res.write('event: response\n');
      for (const line of lines) {
        res.write(`data: ${line}\n`);
      }
      res.write('\n');
    }

    if (event.type === 'tool_result' && event.data.tool === 'knowledge.retrieve') {
      const embeddings = (event.data.output as any)?.embeddings;
      if (Array.isArray(embeddings)) {
        res.write('event: embeddings\n');
        res.write(`data: ${JSON.stringify(embeddings)}\n\n`);
      }
    }

    if (event.type === 'usage') {
      res.write('event: usage\n');
      res.write(
        `data: ${JSON.stringify({
          input_tokens: event.data.input,
          output_tokens: event.data.output,
          total_tokens: event.data.total,
        })}\n\n`,
      );
    }

    if (event.type === 'approval_request') {
      res.write('event: approval_request\n');
      res.write(`data: ${JSON.stringify(event.data)}\n\n`);
    }

    if (event.type === 'artifact') {
      res.write('event: artifact\n');
      res.write(`data: ${JSON.stringify(event.data)}\n\n`);
    }

    if (event.type === 'error') {
      res.write('event: error\n');
      res.write(`data: ${event.data.message}\n\n`);
    }
  };
}

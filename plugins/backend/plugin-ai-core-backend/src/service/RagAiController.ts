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
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseLLM } from '@langchain/core/language_models/llms';
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
import { AgentRuntime } from '../runtime/AgentRuntime';
// For Response.flush()
// @ts-ignore
import type compression from 'compression';

/**
 * HTTP controller for AI backend endpoints.
 *
 * This controller bridges express routes to runtime orchestration, embedding
 * management, SSE streaming, approval handling, and trigger/webhook execution.
 */
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

  /**
   * Returns the list of registered agents and their runtime capabilities.
   */
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

  /**
   * Creates/updates embeddings for a source and optional entity filter.
   */
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

  /**
   * Retrieves augmentation context directly through the retrieval pipeline.
   */
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

  /**
   * Deletes embeddings for a source and optional entity filter.
   */
  deleteEmbeddings = async (req: Request, res: Response) => {
    const source = req.params.source as EmbeddingsSource;
    const entityFilter = req.body.entityFilter;
    await this.augmentationIndexer.deleteEmbeddings(source, entityFilter);
    return res
      .status(201)
      .send({ response: `Embeddings deleted for source ${source}` });
  };

  /**
   * Starts an agent run and streams events to the client over SSE.
   */
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

  /**
   * Applies an approval decision and streams resumed run events over SSE.
   */
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

  /**
   * Replays persisted run events from a sequence checkpoint over SSE.
   */
  streamRunEvents = async (req: Request, res: Response) => {
    const runId = req.params.id;
    const run = await this.runStore?.getRun(runId);
    if (!run) {
      return res.status(404).send({ message: `Run '${runId}' not found` });
    }

    const sinceSeq = this.parseLastEventId(req.header('last-event-id'));
    const steps = await this.runStore?.listRunSteps(runId, sinceSeq);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
    });

    for (const step of steps ?? []) {
      const event = this.fromStoredStep(step.type, step.payload);
      if (event) {
        this.writeEvent(res, event, step.seq);
        res.flush?.();
      }
    }

    return res.end();
  };

  /**
   * Starts a run from a named trigger source.
   */
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

  /**
   * Normalizes provider-specific webhook payloads into trigger execution shape.
   */
  webhookRun = async (req: Request, res: Response) => {
    const provider = req.params.provider;
    const idempotencyKey =
      req.body?.idempotencyKey ??
      (typeof req.header('x-idempotency-key') === 'string'
        ? req.header('x-idempotency-key')
        : undefined);

    req.body = {
      ...req.body,
      idempotencyKey,
      trigger: `webhook:${provider}`,
    };

    return this.triggerRun(req, res);
  };

  /**
   * Executes a run through the runtime and yields its event stream.
   */
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

  /**
   * Creates an optional run timeout abort handler from hardening config.
   */
  private createTimeout(controller: AbortController): NodeJS.Timeout | undefined {
    if (!this.hardening.timeoutMs || this.hardening.timeoutMs <= 0) {
      return undefined;
    }

    return setTimeout(() => {
      controller.abort(new Error('Run timed out'));
    }, this.hardening.timeoutMs);
  }

  /**
   * Aborts in-flight execution when the client disconnects.
   */
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

  /**
   * Consumes one rate-limit token for an agent in a sliding one-minute window.
   */
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

  /**
   * Writes a single structured SSE event frame.
   */
  private writeEvent = (res: Response, event: AgentEvent, seq?: number): void => {
    if (typeof seq === 'number') {
      res.write(`id: ${seq}\n`);
    }
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event.data)}\n\n`);
  };

  /**
   * Parses the SSE Last-Event-ID header into a positive integer sequence.
   */
  private parseLastEventId(value?: string): number {
    if (!value) {
      return 0;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  /**
   * Converts stored run-step records back into typed runtime events.
   */
  private fromStoredStep(type: string, payload: unknown): AgentEvent | undefined {
    if (
      type === 'step' ||
      type === 'token' ||
      type === 'tool_call' ||
      type === 'tool_result' ||
      type === 'usage' ||
      type === 'approval_request' ||
      type === 'artifact' ||
      type === 'done' ||
      type === 'error'
    ) {
      return {
        type,
        data: payload as AgentEvent['data'],
      } as AgentEvent;
    }

    return undefined;
  }
}

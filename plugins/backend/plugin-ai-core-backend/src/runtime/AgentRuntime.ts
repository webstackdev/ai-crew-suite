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
import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import {
  AgentDefinition,
  AgentEvent,
  AgentRunInput,
  ApprovalDecision,
  Orchestrator,
  RunContext,
} from '@webstackbuilders/plugin-ai-core-node';

type RuntimeContext = Omit<RunContext, 'model' | 'systemPrompt'> & {
  model: RunContext['model'];
  systemPrompt?: string;
  orchestratorName?: string;
};

type RunProcessingState = {
  seq: number;
  totalUsage: number;
};

type ResumeProcessingState = {
  seq: number;
};

export const SENSITIVE_KEYS = [
  'authorization',
  'token',
  'apikey',
  'api_key',
  'secret',
  'password',
  'cookie',
];

/**
 * Redacts sensitive keys in nested payloads before persistence or audit logging.
 */
export const redact = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(item => redact(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => {
        const redacted = SENSITIVE_KEYS.some(s =>
          key.toLowerCase().includes(s),
        )
          ? '[REDACTED]'
          : redact(val);
        return [key, redacted];
      }),
    );
  }

  return value;
};

/**
 * Sleeps for a fixed duration, used to implement retry backoff.
 */
export const sleep = async (ms: number) =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

/**
 * Orchestrates agent execution and persistence concerns across orchestrators.
 *
 * This runtime resolves agents/orchestrators, records structured run steps,
 * enforces selected hardening controls, and emits normalized event streams.
 */
export class AgentRuntime {
  constructor(
    private readonly agents: Map<string, AgentDefinition>,
    private readonly orchestrators: Map<string, Orchestrator>,
  ) {}

  /**
   * Executes a new run and streams normalized agent events to callers.
   */
  async *run(input: AgentRunInput, ctx: RuntimeContext): AsyncIterable<AgentEvent> {
    const tracer = trace.getTracer('plugin-ai-core-backend');
    const agent = this.agents.get(input.agentId);
    const runSpan = tracer.startSpan('ai.run', {
      attributes: {
        'ai.run.id': input.runId,
        'ai.agent.id': input.agentId,
        'ai.orchestrator': agent?.orchestrator ?? ctx.orchestratorName ?? 'single-shot',
      },
    });

    try {
      if (!agent) {
        ctx.logger.warn(`Run '${input.runId}' requested unknown agent '${input.agentId}'`);
        yield {
          type: 'error',
          data: { runId: input.runId, message: `Unknown agent '${input.agentId}'` },
        };
        return;
      }

      const orchestratorName = agent.orchestrator ?? 'single-shot';
      const orchestrator =
        this.orchestrators.get(orchestratorName) ??
        this.orchestrators.get('single-shot');

      if (!orchestrator) {
        ctx.logger.error(`No orchestrator registered for '${orchestratorName}'`);
        yield {
          type: 'error',
          data: {
            runId: input.runId,
            message: `No orchestrator registered for '${orchestratorName}'`,
          },
        };
        return;
      }

      await this.createRunRecord(input, ctx);

      const maxRetries = Math.max(0, ctx.hardening?.maxRetries ?? 0);
      const retryBackoffMs = Math.max(50, ctx.hardening?.retryBackoffMs ?? 250);
      const maxTotalTokens = ctx.hardening?.maxTotalTokens;
      const state: RunProcessingState = { seq: 0, totalUsage: 0 };
      let attempt = 0;

      while (attempt <= maxRetries) {
        const cancelled = await this.cancelIfAborted(input.runId, state, ctx);
        if (cancelled) {
          yield cancelled;
          return;
        }

        try {
          for await (const event of orchestrator.run(
            input,
            this.createOrchestratorContext(ctx, agent),
          )) {
            const budgetError = await this.processRunEvent(
              input,
              ctx,
              event,
              state,
              runSpan,
              tracer,
              maxTotalTokens,
            );
            yield event;
            if (budgetError) {
              yield budgetError;
              return;
            }
          }

          return;
        } catch (error: any) {
          const isLastAttempt = attempt >= maxRetries;
          if (isLastAttempt) {
            const failedEvent = await this.failRun(input.runId, state, ctx, error);
            yield failedEvent;
            return;
          }

          const backoffMs = retryBackoffMs * 2 ** attempt;
          ctx.logger.warn(
            `Run '${input.runId}' attempt ${attempt + 1} failed; retrying in ${backoffMs}ms: ${
              error?.message ?? 'Unknown error'
            }`,
          );
          state.seq += 1;
          await ctx.runStore?.appendRunStep(input.runId, state.seq, 'retry', {
            attempt: attempt + 1,
            backoffMs,
            reason: error?.message ?? 'Unknown error',
          });
          await sleep(backoffMs);
          attempt += 1;
        }
      }
    } finally {
      runSpan.end();
    }
  }

  /**
   * Resumes a paused run after a human approval decision.
   */
  async *resume(
    runId: string,
    decision: ApprovalDecision,
    ctx: RuntimeContext,
  ): AsyncIterable<AgentEvent> {
    const run = await ctx.runStore?.getRun(runId);
    if (!run) {
      ctx.logger.warn(`Resume requested for unknown run '${runId}'`);
      yield { type: 'error', data: { runId, message: `Unknown run '${runId}'` } };
      return;
    }

    const agent = this.agents.get(run.agentId);
    if (!agent) {
      ctx.logger.warn(`Resume requested for unknown agent '${run.agentId}' on run '${runId}'`);
      yield {
        type: 'error',
        data: { runId, message: `Unknown agent '${run.agentId}' for run '${runId}'` },
      };
      return;
    }

    const orchestratorName = agent.orchestrator ?? 'single-shot';
    const orchestrator =
      this.orchestrators.get(orchestratorName) ??
      this.orchestrators.get('single-shot');

    if (!orchestrator?.resume) {
      ctx.logger.error(`Orchestrator '${orchestratorName}' does not support resume`);
      yield {
        type: 'error',
        data: {
          runId,
          message: `Orchestrator '${orchestratorName}' does not support resume`,
        },
      };
      return;
    }

    await ctx.runStore?.decideApproval(runId, decision);
    await ctx.runStore?.updateRunStatus(runId, 'running');

    if (decision.status === 'approved') {
      await ctx.auditLogSink?.recordWriteAction({
        id: randomUUID(),
        runId,
        agentId: run.agentId,
        action: 'approval_approved',
        payload: redact(decision),
        actor: decision.decidedBy ?? ctx.identity,
      });
    }

    const state: ResumeProcessingState = { seq: 1000000 };
    for await (const event of orchestrator.resume(
      runId,
      decision,
      this.createOrchestratorContext(ctx, agent),
    )) {
      await this.processResumeEvent(runId, run.agentId, decision, ctx, event, state);
      yield event;
    }
  }

  private createOrchestratorContext(
    ctx: RuntimeContext,
    agent: AgentDefinition,
  ): RunContext {
    return {
      ...ctx,
      systemPrompt: ctx.systemPrompt ?? agent.systemPrompt,
      memory: ctx.memory ?? agent.memory ?? 'none',
    };
  }

  private async createRunRecord(
    input: AgentRunInput,
    ctx: RuntimeContext,
  ): Promise<void> {
    await ctx.runStore?.createRun({
      id: input.runId,
      agentId: input.agentId,
      sessionId: input.input.sessionId,
      status: 'running',
      trigger: input.trigger,
      idempotencyKey: input.idempotencyKey,
    });
  }

  private async appendEvent(
    runId: string,
    state: RunProcessingState | ResumeProcessingState,
    ctx: RuntimeContext,
    event: AgentEvent,
  ): Promise<void> {
    state.seq += 1;
    await ctx.runStore?.appendRunStep(runId, state.seq, event.type, redact(event.data));
  }

  private async cancelIfAborted(
    runId: string,
    state: RunProcessingState,
    ctx: RuntimeContext,
  ): Promise<AgentEvent | undefined> {
    if (!ctx.signal?.aborted) {
      return undefined;
    }

    ctx.logger.warn(`Run '${runId}' cancelled before orchestrator execution`);
    const cancelled: AgentEvent = {
      type: 'error',
      data: { runId, message: 'Run cancelled' },
    };
    await this.appendEvent(runId, state, ctx, cancelled);
    await ctx.runStore?.updateRunStatus(runId, 'error');
    return cancelled;
  }

  private async failRun(
    runId: string,
    state: RunProcessingState,
    ctx: RuntimeContext,
    error: any,
  ): Promise<AgentEvent> {
    ctx.logger.error(`Run '${runId}' failed: ${error?.message ?? error}`);
    const failedEvent: AgentEvent = {
      type: 'error',
      data: {
        runId,
        message: error?.message ?? 'Run failed',
      },
    };
    await this.appendEvent(runId, state, ctx, failedEvent);
    await ctx.runStore?.updateRunStatus(runId, 'error');
    return failedEvent;
  }

  private async processRunEvent(
    input: AgentRunInput,
    ctx: RuntimeContext,
    event: AgentEvent,
    state: RunProcessingState,
    runSpan: ReturnType<ReturnType<typeof trace.getTracer>['startSpan']>,
    tracer: ReturnType<typeof trace.getTracer>,
    maxTotalTokens?: number,
  ): Promise<AgentEvent | undefined> {
    await this.appendEvent(input.runId, state, ctx, event);

    if (event.type === 'tool_call') {
      await this.recordToolCall(input, ctx, event, tracer);
    }

    if (event.type === 'usage') {
      const budgetError = await this.recordUsage(
        input.runId,
        ctx,
        event,
        state,
        runSpan,
        maxTotalTokens,
      );
      if (budgetError) {
        return budgetError;
      }
    }

    if (event.type === 'approval_request') {
      await ctx.runStore?.createApproval({
        id: event.data.approvalId,
        runId: input.runId,
        reason: event.data.reason,
        effect: event.data.effect,
      });
      await ctx.runStore?.updateRunStatus(input.runId, 'paused');
    }

    if (event.type === 'artifact') {
      await this.recordArtifact(input.runId, state.seq, ctx, event);
    }

    await this.updateStatusFromEvent(input.runId, ctx, event);
    return undefined;
  }

  private async recordToolCall(
    input: AgentRunInput,
    ctx: RuntimeContext,
    event: Extract<AgentEvent, { type: 'tool_call' }>,
    tracer: ReturnType<typeof trace.getTracer>,
  ): Promise<void> {
    tracer
      .startSpan('ai.tool.call', {
        attributes: {
          'ai.run.id': input.runId,
          'ai.tool.id': event.data.tool,
        },
      })
      .end();

    const tool = ctx.toolRegistry.get(event.data.tool);
    if (tool?.effect === 'write') {
      await ctx.auditLogSink?.recordWriteAction({
        id: randomUUID(),
        runId: input.runId,
        agentId: input.agentId,
        action: 'write_tool_call',
        toolId: event.data.tool,
        payload: redact(event.data.args),
        actor: ctx.identity,
      });
    }
  }

  private async recordUsage(
    runId: string,
    ctx: RuntimeContext,
    event: Extract<AgentEvent, { type: 'usage' }>,
    state: RunProcessingState,
    runSpan: ReturnType<ReturnType<typeof trace.getTracer>['startSpan']>,
    maxTotalTokens?: number,
  ): Promise<AgentEvent | undefined> {
    runSpan.setAttribute('ai.usage.input', event.data.input);
    runSpan.setAttribute('ai.usage.output', event.data.output);
    runSpan.setAttribute('ai.usage.total', event.data.total);

    if (event.data.total > 0) {
      state.totalUsage += event.data.total;
    }

    if (!maxTotalTokens || state.totalUsage <= maxTotalTokens) {
      return undefined;
    }

    ctx.logger.warn(`Run '${runId}' exceeded token budget (${state.totalUsage}/${maxTotalTokens})`);
    const budgetError: AgentEvent = {
      type: 'error',
      data: {
        runId,
        message: `Token budget exceeded (${state.totalUsage}/${maxTotalTokens})`,
      },
    };
    await this.appendEvent(runId, state, ctx, budgetError);
    await ctx.runStore?.updateRunStatus(runId, 'error');
    return budgetError;
  }

  private async recordArtifact(
    runId: string,
    seq: number,
    ctx: RuntimeContext,
    event: Extract<AgentEvent, { type: 'artifact' }>,
  ): Promise<void> {
    await ctx.artifactSink?.record({
      id: `${runId}:${seq}`,
      runId,
      kind: event.data.kind,
      ref: event.data.ref,
      url: event.data.url,
    });
  }

  private async updateStatusFromEvent(
    runId: string,
    ctx: RuntimeContext,
    event: AgentEvent,
  ): Promise<void> {
    if (event.type === 'done') {
      await ctx.runStore?.updateRunStatus(runId, 'done');
    }

    if (event.type === 'error') {
      await ctx.runStore?.updateRunStatus(runId, 'error');
    }
  }

  private async processResumeEvent(
    runId: string,
    agentId: string,
    decision: ApprovalDecision,
    ctx: RuntimeContext,
    event: AgentEvent,
    state: ResumeProcessingState,
  ): Promise<void> {
    await this.appendEvent(runId, state, ctx, event);

    if (event.type === 'artifact') {
      await this.recordArtifact(runId, state.seq, ctx, event);
      await ctx.auditLogSink?.recordWriteAction({
        id: randomUUID(),
        runId,
        agentId,
        action: 'artifact_recorded',
        payload: redact(event.data),
        actor: decision.decidedBy ?? ctx.identity,
      });
    }

    await this.updateStatusFromEvent(runId, ctx, event);
  }
}

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
import {
  AgentDefinition,
  AgentEvent,
  AgentRunInput,
  ApprovalDecision,
  Orchestrator,
  RunContext,
} from '@webstackbuilders/plugin-ai-core-node';
import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';

const SENSITIVE_KEYS = [
  'authorization',
  'token',
  'apikey',
  'api_key',
  'secret',
  'password',
  'cookie',
];

const redact = (value: unknown): unknown => {
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

const sleep = async (ms: number) =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

export class AgentRuntime {
  constructor(
    private readonly agents: Map<string, AgentDefinition>,
    private readonly orchestrators: Map<string, Orchestrator>,
  ) {}

  async *run(input: AgentRunInput, ctx: Omit<RunContext, 'model' | 'systemPrompt'> & {
    model: RunContext['model'];
    systemPrompt?: string;
    orchestratorName?: string;
  }): AsyncIterable<AgentEvent> {
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
        yield {
          type: 'error',
          data: {
            runId: input.runId,
            message: `No orchestrator registered for '${orchestratorName}'`,
          },
        };
        return;
      }

      if (ctx.runStore) {
        await ctx.runStore.createRun({
          id: input.runId,
          agentId: input.agentId,
          sessionId: input.input.sessionId,
          status: 'running',
          trigger: input.trigger,
          idempotencyKey: input.idempotencyKey,
        });
      }

      const maxRetries = Math.max(0, ctx.hardening?.maxRetries ?? 0);
      const retryBackoffMs = Math.max(50, ctx.hardening?.retryBackoffMs ?? 250);
      const maxTotalTokens = ctx.hardening?.maxTotalTokens;

      let seq = 0;
      let attempt = 0;
      let totalUsage = 0;

      while (attempt <= maxRetries) {
        if (ctx.signal?.aborted) {
          const cancelled: AgentEvent = {
            type: 'error',
            data: {
              runId: input.runId,
              message: 'Run cancelled',
            },
          };
          seq += 1;
          await ctx.runStore?.appendRunStep(
            input.runId,
            seq,
            cancelled.type,
            redact(cancelled.data),
          );
          await ctx.runStore?.updateRunStatus(input.runId, 'error');
          yield cancelled;
          return;
        }

        try {
          for await (const event of orchestrator.run(input, {
            ...ctx,
            systemPrompt: ctx.systemPrompt ?? agent.systemPrompt,
            memory: ctx.memory ?? agent.memory ?? 'none',
          })) {
            seq += 1;
            await ctx.runStore?.appendRunStep(
              input.runId,
              seq,
              event.type,
              redact(event.data),
            );

            if (event.type === 'tool_call') {
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

            if (event.type === 'usage') {
              runSpan.setAttribute('ai.usage.input', event.data.input);
              runSpan.setAttribute('ai.usage.output', event.data.output);
              runSpan.setAttribute('ai.usage.total', event.data.total);

              if (event.data.total > 0) {
                totalUsage += event.data.total;
              }

              if (maxTotalTokens && totalUsage > maxTotalTokens) {
                const budgetError: AgentEvent = {
                  type: 'error',
                  data: {
                    runId: input.runId,
                    message: `Token budget exceeded (${totalUsage}/${maxTotalTokens})`,
                  },
                };
                seq += 1;
                await ctx.runStore?.appendRunStep(
                  input.runId,
                  seq,
                  budgetError.type,
                  redact(budgetError.data),
                );
                await ctx.runStore?.updateRunStatus(input.runId, 'error');
                yield budgetError;
                return;
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
              await ctx.artifactSink?.record({
                id: `${input.runId}:${seq}`,
                runId: input.runId,
                kind: event.data.kind,
                ref: event.data.ref,
                url: event.data.url,
              });
            }

            if (event.type === 'done') {
              await ctx.runStore?.updateRunStatus(input.runId, 'done');
            }

            if (event.type === 'error') {
              await ctx.runStore?.updateRunStatus(input.runId, 'error');
            }

            yield event;
          }

          return;
        } catch (error: any) {
          const isLastAttempt = attempt >= maxRetries;
          if (isLastAttempt) {
            const failedEvent: AgentEvent = {
              type: 'error',
              data: {
                runId: input.runId,
                message: error?.message ?? 'Run failed',
              },
            };
            seq += 1;
            await ctx.runStore?.appendRunStep(
              input.runId,
              seq,
              failedEvent.type,
              redact(failedEvent.data),
            );
            await ctx.runStore?.updateRunStatus(input.runId, 'error');
            yield failedEvent;
            return;
          }

          const backoffMs = retryBackoffMs * 2 ** attempt;
          seq += 1;
          await ctx.runStore?.appendRunStep(input.runId, seq, 'retry', {
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

  async *resume(
    runId: string,
    decision: ApprovalDecision,
    ctx: Omit<RunContext, 'model' | 'systemPrompt'> & {
      model: RunContext['model'];
      systemPrompt?: string;
      orchestratorName?: string;
    },
  ): AsyncIterable<AgentEvent> {
    const run = await ctx.runStore?.getRun(runId);
    if (!run) {
      yield { type: 'error', data: { runId, message: `Unknown run '${runId}'` } };
      return;
    }

    const agent = this.agents.get(run.agentId);
    if (!agent) {
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

    let seq = 1000000;
    for await (const event of orchestrator.resume(runId, decision, {
      ...ctx,
      systemPrompt: ctx.systemPrompt ?? agent.systemPrompt,
      memory: ctx.memory ?? agent.memory ?? 'none',
    })) {
      seq += 1;
      await ctx.runStore?.appendRunStep(runId, seq, event.type, redact(event.data));

      if (event.type === 'artifact') {
        await ctx.artifactSink?.record({
          id: `${runId}:${seq}`,
          runId,
          kind: event.data.kind,
          ref: event.data.ref,
          url: event.data.url,
        });

        await ctx.auditLogSink?.recordWriteAction({
          id: randomUUID(),
          runId,
          agentId: run.agentId,
          action: 'artifact_recorded',
          payload: redact(event.data),
          actor: decision.decidedBy ?? ctx.identity,
        });
      }

      if (event.type === 'done') {
        await ctx.runStore?.updateRunStatus(runId, 'done');
      }

      if (event.type === 'error') {
        await ctx.runStore?.updateRunStatus(runId, 'error');
      }

      yield event;
    }
  }
}

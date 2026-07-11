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

      let seq = 0;

      for await (const event of orchestrator.run(input, {
        ...ctx,
        systemPrompt: ctx.systemPrompt ?? agent.systemPrompt,
        memory: ctx.memory ?? agent.memory ?? 'none',
      })) {
        seq += 1;
        await ctx.runStore?.appendRunStep(input.runId, seq, event.type, event.data);

        if (event.type === 'tool_call') {
          tracer.startSpan('ai.tool.call', {
            attributes: {
              'ai.run.id': input.runId,
              'ai.tool.id': event.data.tool,
            },
          }).end();
        }

        if (event.type === 'usage') {
          runSpan.setAttribute('ai.usage.input', event.data.input);
          runSpan.setAttribute('ai.usage.output', event.data.output);
          runSpan.setAttribute('ai.usage.total', event.data.total);
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

    let seq = 1000000;
    for await (const event of orchestrator.resume(runId, decision, {
      ...ctx,
      systemPrompt: ctx.systemPrompt ?? agent.systemPrompt,
      memory: ctx.memory ?? agent.memory ?? 'none',
    })) {
      seq += 1;
      await ctx.runStore?.appendRunStep(runId, seq, event.type, event.data);

      if (event.type === 'artifact') {
        await ctx.artifactSink?.record({
          id: `${runId}:${seq}`,
          runId,
          kind: event.data.kind,
          ref: event.data.ref,
          url: event.data.url,
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

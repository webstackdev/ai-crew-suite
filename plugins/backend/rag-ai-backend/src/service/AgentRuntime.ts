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
    const runSpan = tracer.startSpan('ai.run', {
      attributes: {
        'ai.run.id': input.runId,
        'ai.agent.id': input.agentId,
        'ai.orchestrator': ctx.orchestratorName ?? 'single-shot',
      },
    });

    try {
      const agent = this.agents.get(input.agentId);
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

      for await (const event of orchestrator.run(input, {
        ...ctx,
        systemPrompt: ctx.systemPrompt ?? agent.systemPrompt,
      })) {
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

        yield event;
      }
    } finally {
      runSpan.end();
    }
  }
}

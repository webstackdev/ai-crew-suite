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
import { AIMessageChunk } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseLLM } from '@langchain/core/language_models/llms';
import {
  AgentDefinition,
  AgentEvent,
  AgentRunInput,
  EmbeddingDoc,
  Orchestrator,
  RunContext,
} from '@webstackbuilders/plugin-ai-core-node';
import { LlmService } from './LlmService';

type UsageMetadata = {
  total_tokens: number;
  output_tokens: number;
  input_tokens: number;
};

type CrewRole = {
  id: string;
  systemPrompt: string;
  modelRef?: string;
  toolIds?: string[];
};

const defaultRoles = (basePrompt: string): CrewRole[] => [
  {
    id: 'researcher',
    systemPrompt:
      'You are the Researcher role. Gather concrete facts and constraints from the available context and tools.',
  },
  {
    id: 'writer',
    systemPrompt:
      'You are the Writer role. Produce a clear and actionable draft using the researcher output.',
  },
  {
    id: 'reviewer',
    systemPrompt:
      `You are the Reviewer role. Improve quality and correctness. Also respect this baseline policy: ${basePrompt}`,
  },
];

export class CrewOrchestrator implements Orchestrator {
  constructor(
    private readonly llmService: LlmService,
    private readonly agents: Map<string, AgentDefinition>,
    private readonly models: Map<string, BaseLLM | BaseChatModel>,
  ) {}

  async *run(input: AgentRunInput, ctx: RunContext): AsyncIterable<AgentEvent> {
    const { runId } = input;
    let seq = 0;
    const nextSeq = () => {
      seq += 1;
      return seq;
    };

    const agent = this.agents.get(input.agentId);
    const roles = agent?.crew?.roles?.length
      ? agent.crew.roles
      : defaultRoles(agent?.systemPrompt ?? ctx.systemPrompt ?? '');

    yield {
      type: 'step',
      data: { runId, seq: nextSeq(), node: 'crew', phase: 'enter' },
    };

    const retrieveArgs = {
      query: input.input.query,
      source: input.input.source,
      entityFilter: input.input.entityFilter,
    };

    yield {
      type: 'tool_call',
      data: { runId, tool: 'knowledge.retrieve', args: retrieveArgs },
    };

    const retrievalTool = ctx.toolRegistry.get('knowledge.retrieve');
    if (!retrievalTool) {
      yield {
        type: 'error',
        data: { runId, message: "Tool 'knowledge.retrieve' is not registered" },
      };
      return;
    }

    const retrievalOutput = await retrievalTool.invoke(retrieveArgs, {
      credentials: undefined,
      auth: undefined,
      discovery: undefined,
      logger: ctx.logger,
      identity: ctx.identity ?? 'anonymous',
      runId,
      signal: ctx.signal ?? new AbortController().signal,
    });

    const embeddings = Array.isArray(retrievalOutput)
      ? (retrievalOutput as EmbeddingDoc[])
      : [];

    yield {
      type: 'tool_result',
      data: {
        runId,
        tool: 'knowledge.retrieve',
        ok: true,
        summary: `${embeddings.length} embeddings retrieved`,
      },
    };

    const usage = { input: 0, output: 0, total: 0 };
    let previousOutput = '';

    for (const role of roles) {
      yield {
        type: 'step',
        data: { runId, seq: nextSeq(), node: `crew.${role.id}`, phase: 'enter' },
      };

      const roleModel = role.modelRef
        ? this.models.get(role.modelRef) ?? ctx.model
        : ctx.model;

      const roleQuery = previousOutput
        ? `Original request: ${input.input.query}\n\nPrevious role output:\n${previousOutput}`
        : input.input.query;

      const stream = await this.llmService.query(embeddings, roleQuery, {
        model: roleModel,
        systemPrompt: role.systemPrompt,
      });

      let roleOutput = '';
      for await (const chunk of stream) {
        if (typeof chunk !== 'string' && 'usage_metadata' in chunk) {
          const metadata = (chunk as AIMessageChunk)
            .usage_metadata as UsageMetadata | undefined;
          usage.input += metadata?.input_tokens ?? 0;
          usage.output += metadata?.output_tokens ?? 0;
          usage.total += metadata?.total_tokens ?? 0;
        }

        const text =
          typeof chunk === 'string'
            ? chunk
            : ((chunk as AIMessageChunk).content as string);

        if (text) {
          roleOutput += text;

          if (role.id === roles[roles.length - 1].id) {
            yield {
              type: 'token',
              data: { runId, text },
            };
          }
        }
      }

      previousOutput = roleOutput;

      yield {
        type: 'step',
        data: { runId, seq: nextSeq(), node: `crew.${role.id}`, phase: 'exit' },
      };
    }

    const artifactUrl = `memory://artifacts/${runId}/crew-output.md`;
    yield {
      type: 'artifact',
      data: {
        runId,
        kind: 'doc',
        ref: 'crew-output',
        url: artifactUrl,
      },
    };

    await ctx.checkpointStore?.save(runId, {
      runId,
      sessionId: input.input.sessionId,
      status: 'done',
      orchestrator: 'crew',
      output: previousOutput,
      artifactUrl,
      completedAt: new Date().toISOString(),
    });

    yield {
      type: 'usage',
      data: {
        runId,
        input: usage.input || -1,
        output: usage.output || -1,
        total: usage.total || -1,
      },
    };

    yield {
      type: 'step',
      data: { runId, seq: nextSeq(), node: 'crew', phase: 'exit' },
    };

    yield {
      type: 'done',
      data: {
        runId,
        sessionId: input.input.sessionId,
      },
    };
  }
}

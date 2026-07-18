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
import { LlmService } from '../runtime/LlmService';
import type { CrewRole, UsageMetadata } from '../@types';

const defaultRoles = (basePrompt: string): CrewRole[] => [
  {
    id: 'researcher',
    systemPrompt: 'You are the Researcher role. Gather concrete facts and constraints from the available context and tools.',
  },
  {
    id: 'writer',
    systemPrompt: 'You are the Writer role. Produce a clear and actionable draft using the researcher output.',
  },
  {
    id: 'reviewer',
    systemPrompt: `You are the Reviewer role. Improve quality and correctness. Also respect this baseline policy: ${basePrompt}`,
  },
];

/**
 * Multi-role orchestrator that executes sequential crew handoffs.
 */
export class CrewOrchestrator implements Orchestrator {
  private seq = 0;

  constructor(
    private readonly llmService: LlmService,
    private readonly agents: Map<string, AgentDefinition>,
    private readonly models: Map<string, BaseLLM | BaseChatModel>,
  ) {}

  /**
   * Primary entry point coordinating the high-level life cycle phases of the crew run.
   */
  async *run(input: AgentRunInput, ctx: RunContext): AsyncIterable<AgentEvent> {
    const { runId } = input;
    this.seq = 0;

    const agent = this.agents.get(input.agentId);
    const roles = agent?.crew?.roles?.length
      ? agent.crew.roles
      : defaultRoles(agent?.systemPrompt ?? ctx.systemPrompt ?? '');

    yield this.createStepEvent(runId, 'crew', 'enter');

    // Phase 1: Context Augmentation (RAG Fetch)
    let embeddings: EmbeddingDoc[] = [];
    try {
      embeddings = await this.executeRetrieval(input, ctx);
      yield {
        type: 'tool_result',
        data: { runId, tool: 'knowledge.retrieve', ok: true, summary: `${embeddings.length} embeddings retrieved` },
      };
    } catch (error: any) {
      yield { type: 'error', data: { runId, message: error.message } };
      return;
    }

    // Phase 2: Sequential Multi-Agent Execution Loop
    const usage = { input: 0, output: 0, total: 0 };
    let previousOutput = '';

    for (const role of roles) {
      yield this.createStepEvent(runId, `crew.${role.id}`, 'enter');

      const isFinalRole = role.id === roles[roles.length - 1].id;
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

      // Stream text chunks and yield token tokens if final role
      previousOutput = '';
      for await (const chunk of stream) {
        this.accumulateUsageMetrics(chunk, usage);
        const text = this.extractTextContent(chunk);

        if (text) {
          previousOutput += text;
          if (isFinalRole) {
            yield { type: 'token', data: { runId, text } };
          }
        }
      }

      yield this.createStepEvent(runId, `crew.${role.id}`, 'exit');
    }

    // Phase 3: Finalizing Artifacts, Checkpoints, and Metrics
    const artifactUrl = `memory://artifacts/${runId}/crew-output.md`;
    yield { type: 'artifact', data: { runId, kind: 'doc', ref: 'crew-output', url: artifactUrl } };

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
      data: { runId, input: usage.input || -1, output: usage.output || -1, total: usage.total || -1 },
    };

    yield this.createStepEvent(runId, 'crew', 'exit');
    yield { type: 'done', data: { runId, sessionId: input.input.sessionId } };
  }

  /**
   * Resolves the knowledge base retrieval tool and extracts document embeddings.
   */
  private async executeRetrieval(input: AgentRunInput, ctx: RunContext): Promise<EmbeddingDoc[]> {
    const retrieveArgs = {
      query: input.input.query,
      source: input.input.source,
      entityFilter: input.input.entityFilter,
    };

    const retrievalTool = ctx.toolRegistry.get('knowledge.retrieve');
    if (!retrievalTool) {
      throw new Error("Tool 'knowledge.retrieve' is not registered");
    }

    const output = await retrievalTool.invoke(retrieveArgs, {
      credentials: undefined,
      auth: undefined,
      discovery: undefined,
      logger: ctx.logger,
      identity: ctx.identity ?? 'anonymous',
      runId: input.runId,
      signal: ctx.signal ?? new AbortController().signal,
    });

    return Array.isArray(output) ? (output as EmbeddingDoc[]) : [];
  }

  /**
   * Standardizes text parsing from polymorphic LangChain stream chunks.
   */
  private extractTextContent(chunk: string | AIMessageChunk): string {
    if (typeof chunk === 'string') {
      return chunk;
    }
    return (chunk.content as string) || '';
  }

  /**
   * Aggregates token usage counts from streaming chunks into the global reference tracker.
   */
  private accumulateUsageMetrics(chunk: string | AIMessageChunk, usage: Record<string, number>): void {
    if (typeof chunk !== 'string' && 'usage_metadata' in chunk) {
      const metadata = chunk.usage_metadata as UsageMetadata | undefined;
      usage.input += metadata?.input_tokens ?? 0;
      usage.output += metadata?.output_tokens ?? 0;
      usage.total += metadata?.total_tokens ?? 0;
    }
  }

  /**
   * Helper factory to cleanly emit state-machine telemetry steps.
   */
  private createStepEvent(runId: string, node: string, phase: 'enter' | 'exit'): AgentEvent {
    this.seq += 1;
    return {
      type: 'step',
      data: { runId, seq: this.seq, node, phase },
    };
  }
}

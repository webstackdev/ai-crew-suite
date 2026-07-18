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
import {
  AgentEvent,
  AgentRunInput,
  EmbeddingDoc,
  Orchestrator,
  RunContext,
} from '@webstackbuilders/plugin-ai-core-node';
import { LlmService } from '../runtime/LlmService';
import type { UsageMetadata } from '../@types';

/**
 * Baseline orchestrator performing a single-step retrieval and response cycle.
 */
export class SingleShotOrchestrator implements Orchestrator {
  private seq = 0;

  constructor(private readonly llmService: LlmService) {}

  /**
   * Primary orchestrator execution engine loop.
   */
  async *run(input: AgentRunInput, ctx: RunContext): AsyncIterable<AgentEvent> {
    const { runId } = input;
    const sessionId = input.input.sessionId;
    this.seq = 0;

    yield this.emitStep(runId, 'single-shot', 'enter');

    // Phase 1: Context Augmentation (RAG Fetch)
    let embeddings: EmbeddingDoc[] = [];
    try {
      embeddings = await this.executeRetrieval(runId, input, ctx);
    } catch (error: any) {
      yield { type: 'error', data: { runId, message: error.message } };
      return;
    }

    // Phase 2: Simple LLM Execution Core
    const usage = { input: 0, output: 0, total: 0 };
    const stream = await this.llmService.query(embeddings, input.input.query, {
      model: ctx.model,
      systemPrompt: ctx.systemPrompt,
    });

    for await (const chunk of stream) {
      this.accumulateMetrics(chunk, usage);
      const text = this.extractChunkText(chunk);

      if (text) {
        yield { type: 'token', data: { runId, text } };
      }
    }

    // Phase 3: Finalizing Metrics and Trace States
    yield {
      type: 'usage',
      data: { runId, input: usage.input || -1, output: usage.output || -1, total: usage.total || -1 },
    };

    yield this.emitStep(runId, 'single-shot', 'exit');
    yield { type: 'done', data: { runId, sessionId } };
  }

  /**
   * Tool Component: Resolves and executes the registered knowledge storage engines.
   */
  private async executeRetrieval(runId: string, input: AgentRunInput, ctx: RunContext): Promise<EmbeddingDoc[]> {
    const retrieveArgs = {
      query: input.input.query,
      source: input.input.source,
      entityFilter: input.input.entityFilter,
    };

    const retrievalTool = ctx.toolRegistry.get('knowledge.retrieve');
    if (!retrievalTool) {
      throw new Error("Tool 'knowledge.retrieve' is not registered");
    }

    const toolOutput = await retrievalTool.invoke(retrieveArgs, {
      credentials: undefined, auth: undefined, discovery: undefined, logger: ctx.logger,
      identity: ctx.identity ?? 'anonymous', runId, signal: ctx.signal ?? new AbortController().signal,
    });

    return Array.isArray(toolOutput) ? (toolOutput as EmbeddingDoc[]) : [];
  }

  /**
   * Token Parsing Component: Normalizes stream tokens across chunk layouts.
   */
  private extractChunkText(chunk: string | AIMessageChunk): string {
    return typeof chunk === 'string' ? chunk : (chunk.content as string) || '';
  }

  /**
   * Token Analytics Component: Combines metric schemas during text iteration blocks.
   */
  private accumulateMetrics(chunk: string | AIMessageChunk, usage: Record<string, number>): void {
    if (typeof chunk !== 'string' && 'usage_metadata' in chunk) {
      const metadata = chunk.usage_metadata as UsageMetadata | undefined;
      usage.input += metadata?.input_tokens ?? 0;
      usage.output += metadata?.output_tokens ?? 0;
      usage.total += metadata?.total_tokens ?? 0;
    }
  }

  /**
   * Telemetry Factory: Simplifies linear trace serialization trackers.
   */
  private emitStep(runId: string, node: string, phase: 'enter' | 'exit'): AgentEvent {
    this.seq += 1;
    return { type: 'step', data: { runId, seq: this.seq, node, phase } };
  }
}

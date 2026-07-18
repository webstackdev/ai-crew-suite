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
import { AIMessageChunk } from '@langchain/core/messages';
import {
  AgentEvent,
  AgentRunInput,
  ApprovalDecision,
  EmbeddingDoc,
  Orchestrator,
  RunContext,
  SessionMessage,
} from '@webstackbuilders/plugin-ai-core-node';
import { LlmService } from '../runtime/LlmService';
import type { UsageMetadata } from '../@types';

const HISTORY_LIMIT = 8;

const formatHistory = (messages: SessionMessage[]): string => {
  if (messages.length === 0) return '';
  const rendered = messages
    .slice(-HISTORY_LIMIT)
    .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n');
  return `Conversation history:\n${rendered}\n\n`;
};

/**
 * Stateful orchestrator matching LangGraph lifecycle state paradigms.
 */
export class LangGraphOrchestrator implements Orchestrator {
  private seq = 0;

  constructor(private readonly llmService: LlmService) {}

  /**
   * Primary orchestrator execution engine loop.
   */
  async *run(input: AgentRunInput, ctx: RunContext): AsyncIterable<AgentEvent> {
    const { runId } = input;
    const sessionId = input.input.sessionId;
    this.seq = 0;

    yield this.emitStep(runId, 'langgraph', 'enter');

    // Phase 1: Load Conversation History Context
    const history = await this.loadHistoryContext(runId, sessionId, ctx);

    // Phase 2: Handle RAG Augmentation Pipeline
    let embeddings: EmbeddingDoc[] = [];
    try {
      embeddings = await this.executeRetrievalPipeline(runId, input, ctx);
    } catch (error: any) {
      yield { type: 'error', data: { runId, message: error.message } };
      return;
    }

    // Phase 3: Execute Streaming Engine Core
    const composedQuery = `${formatHistory(history)}User question: ${input.input.query}`;
    const usage = { input: 0, output: 0, total: 0 };
    let fullResponse = '';

    const stream = await this.llmService.query(embeddings, composedQuery, {
      model: ctx.model,
      systemPrompt: ctx.systemPrompt,
    });

    for await (const chunk of stream) {
      this.accumulateMetrics(chunk, usage);
      const text = this.extractChunkText(chunk);

      if (text) {
        fullResponse += text;
        yield { type: 'token', data: { runId, text } };
      }
    }

    // Phase 4: State Serialization and Human-In-The-Loop Guards
    await this.persistSessionHistory(sessionId, input.input.query, fullResponse, usage, ctx);
    await this.saveLifecycleCheckpoint(runId, input.agentId, sessionId, input.input.query, fullResponse, ctx);

    if (this.requiresApprovalGuard(input.input.query, ctx)) {
      yield* this.handleApprovalInterrupt(runId, input.agentId, sessionId, ctx);
      return;
    }

    // Phase 5: Normal Flow Finalization Telemetry
    yield {
      type: 'usage',
      data: { runId, input: usage.input || -1, output: usage.output || -1, total: usage.total || -1 },
    };

    yield this.emitStep(runId, 'langgraph', 'exit');
    yield { type: 'done', data: { runId, sessionId } };
  }

  /**
   * Continues an interrupted state run after a human approval action.
   */
  async *resume(runId: string, decision: ApprovalDecision, ctx: RunContext): AsyncIterable<AgentEvent> {
    const state = await ctx.checkpointStore?.load<{
      runId: string;
      sessionId?: string;
      status?: string;
      proposedArtifact?: { kind: string; ref?: string; url?: string };
    }>(runId);

    if (!state) {
      yield { type: 'error', data: { runId, message: `No checkpoint found for run '${runId}'` } };
      return;
    }

    if (decision.status === 'rejected') {
      yield { type: 'error', data: { runId, message: decision.note ?? 'Write action was rejected during approval' } };
      return;
    }

    yield { type: 'step', data: { runId, seq: 1, node: 'approval.resume', phase: 'enter' } };

    const artifact = state.proposedArtifact ?? { kind: 'change', ref: 'approved-action' };
    yield { type: 'artifact', data: { runId, kind: artifact.kind, ref: artifact.ref, url: artifact.url } };

    await ctx.checkpointStore?.save(runId, {
      ...state,
      status: 'done',
      resumedAt: new Date().toISOString(),
    });
  }

  /**
   * Context Component: Fetches and emits telemetry metadata for conversation history memory.
   */
  private async loadHistoryContext(runId: string, sessionId: string | undefined, ctx: RunContext): Promise<SessionMessage[]> {
    if (!ctx.sessionStore || !sessionId) return [];
    
    this.emitStep(runId, 'memory.load', 'enter');
    const history = await ctx.sessionStore.listMessages(sessionId, HISTORY_LIMIT);
    this.emitStep(runId, 'memory.load', 'exit');
    
    return history;
  }

  /**
   * Tool Component: Executes downstream RAG storage tools.
   */
  private async executeRetrievalPipeline(runId: string, input: AgentRunInput, ctx: RunContext): Promise<EmbeddingDoc[]> {
    const retrieveArgs = { query: input.input.query, source: input.input.source, entityFilter: input.input.entityFilter };
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
   * State Storage Component: Syncs running telemetry variables back to standard Backstage session schemas.
   */
  private async persistSessionHistory(sessionId: string | undefined, query: string, response: string, usage: Record<string, number>, ctx: RunContext): Promise<void> {
    if (!ctx.sessionStore || !sessionId) return;

    this.emitStep(sessionId, 'memory.persist', 'enter');
    await ctx.sessionStore.appendMessage(sessionId, { role: 'user', content: query });
    await ctx.sessionStore.appendMessage(sessionId, {
      role: 'assistant',
      content: response,
      tokenUsage: { input: usage.input || -1, output: usage.output || -1, total: usage.total || -1 },
    });
    this.emitStep(sessionId, 'memory.persist', 'exit');
  }

  /**
   * Checkpoint Component: Persists run traces safely across backend frames.
   */
  private async saveLifecycleCheckpoint(runId: string, agentId: string, sessionId: string | undefined, query: string, response: string, ctx: RunContext): Promise<void> {
    if (!ctx.checkpointStore) return;
    await ctx.checkpointStore.save(runId, {
      runId, agentId, sessionId, query, response, status: 'done', completedAt: new Date().toISOString(),
    });
  }

  /**
   * Verification Guard Heuristic: Determines whether the engine context requires human authorization blocks.
   */
  private requiresApprovalGuard(query: string, ctx: RunContext): boolean {
    const hasWriteTool = ctx.toolRegistry.list().some(tool => tool.effect === 'write');
    return hasWriteTool && /\b(create|open|write|apply|update|delete|pr|issue)\b/i.test(query);
  }

  /**
   * State Machine Control flow: Interrupts state loop execution thread until human validation events settle.
   */
  private async *handleApprovalInterrupt(runId: string, agentId: string, sessionId: string | undefined, ctx: RunContext): AsyncIterable<AgentEvent> {
    const approvalId = randomUUID();
    await ctx.checkpointStore?.save(runId, {
      runId, agentId, sessionId, proposedArtifact: { kind: 'draft', ref: 'pending-write-action', url: undefined }, status: 'awaiting_approval',
    });

    yield {
      type: 'approval_request',
      data: { runId, approvalId, reason: 'This action may modify external systems and requires approval.', effect: 'write' },
    };
  }

  /**
   * Telemetry Factory: Simplifies linear trace serialization trackers.
   */
  private emitStep(runId: string, node: string, phase: 'enter' | 'exit'): AgentEvent {
    this.seq += 1;
    return { type: 'step', data: { runId, seq: this.seq, node, phase } };
  }
}

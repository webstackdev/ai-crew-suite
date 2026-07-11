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
import {
  AgentEvent,
  AgentRunInput,
  ApprovalDecision,
  EmbeddingDoc,
  Orchestrator,
  RunContext,
  SessionMessage,
} from '@webstackbuilders/plugin-ai-core-node';
import { randomUUID } from 'crypto';
import { LlmService } from './LlmService';

type UsageMetadata = {
  total_tokens: number;
  output_tokens: number;
  input_tokens: number;
};

const HISTORY_LIMIT = 8;

const formatHistory = (messages: SessionMessage[]): string => {
  if (messages.length === 0) {
    return '';
  }

  const rendered = messages
    .slice(-HISTORY_LIMIT)
    .map(message => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n');

  return `Conversation history:\n${rendered}\n\n`;
};

export class LangGraphOrchestrator implements Orchestrator {
  constructor(private readonly llmService: LlmService) {}

  async *run(input: AgentRunInput, ctx: RunContext): AsyncIterable<AgentEvent> {
    const { runId } = input;
    let seq = 0;
    const nextSeq = () => {
      seq += 1;
      return seq;
    };

    const checkpointStore = ctx.checkpointStore;
    const sessionStore = ctx.sessionStore;
    const sessionId = input.input.sessionId;

    yield {
      type: 'step',
      data: { runId, seq: nextSeq(), node: 'langgraph', phase: 'enter' },
    };

    let history: SessionMessage[] = [];
    if (sessionStore && sessionId) {
      history = await sessionStore.listMessages(sessionId, HISTORY_LIMIT);
      yield {
        type: 'step',
        data: { runId, seq: nextSeq(), node: 'memory.load', phase: 'enter' },
      };
      yield {
        type: 'step',
        data: { runId, seq: nextSeq(), node: 'memory.load', phase: 'exit' },
      };
    }

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

    let embeddings: EmbeddingDoc[] = [];
    try {
      const toolOutput = await retrievalTool.invoke(retrieveArgs, {
        credentials: undefined,
        auth: undefined,
        discovery: undefined,
        logger: ctx.logger,
        identity: ctx.identity ?? 'anonymous',
        runId,
        signal: ctx.signal ?? new AbortController().signal,
      });

      embeddings = Array.isArray(toolOutput) ? (toolOutput as EmbeddingDoc[]) : [];

      yield {
        type: 'tool_result',
        data: {
          runId,
          tool: 'knowledge.retrieve',
          ok: true,
          summary: `${embeddings.length} embeddings retrieved`,
          output: { embeddings },
        },
      };
    } catch (error: any) {
      yield {
        type: 'tool_result',
        data: {
          runId,
          tool: 'knowledge.retrieve',
          ok: false,
          summary: error?.message ?? 'Failed to retrieve embeddings',
        },
      };
      yield {
        type: 'error',
        data: {
          runId,
          message: error?.message ?? 'Failed to run knowledge.retrieve',
        },
      };
      return;
    }

    const composedQuery = `${formatHistory(history)}User question: ${input.input.query}`;

    const usage = { input: 0, output: 0, total: 0 };
    let fullResponse = '';

    const stream = await this.llmService.query(embeddings, composedQuery, {
      model: ctx.model,
      systemPrompt: ctx.systemPrompt,
    });

    for await (const chunk of stream) {
      if (typeof chunk !== 'string' && 'usage_metadata' in chunk) {
        const metadata = (chunk as AIMessageChunk)
          .usage_metadata as UsageMetadata | undefined;
        usage.input += metadata?.input_tokens ?? 0;
        usage.output += metadata?.output_tokens ?? 0;
        usage.total += metadata?.total_tokens ?? 0;
      }

      const text =
        typeof chunk === 'string' ? chunk : ((chunk as AIMessageChunk).content as string);

      if (text) {
        fullResponse += text;
        yield {
          type: 'token',
          data: { runId, text },
        };
      }
    }

    if (sessionStore && sessionId) {
      yield {
        type: 'step',
        data: { runId, seq: nextSeq(), node: 'memory.persist', phase: 'enter' },
      };
      await sessionStore.appendMessage(sessionId, {
        role: 'user',
        content: input.input.query,
      });
      await sessionStore.appendMessage(sessionId, {
        role: 'assistant',
        content: fullResponse,
        tokenUsage: {
          input: usage.input || -1,
          output: usage.output || -1,
          total: usage.total || -1,
        },
      });
      yield {
        type: 'step',
        data: { runId, seq: nextSeq(), node: 'memory.persist', phase: 'exit' },
      };
    }

    if (checkpointStore) {
      await checkpointStore.save(runId, {
        runId,
        agentId: input.agentId,
        sessionId,
        query: input.input.query,
        response: fullResponse,
        status: 'done',
        completedAt: new Date().toISOString(),
      });
    }

    const hasWriteTool = ctx
      .toolRegistry
      .list()
      .some(tool => tool.effect === 'write');
    const shouldRequestApproval = hasWriteTool && /\b(create|open|write|apply|update|delete|pr|issue)\b/i.test(input.input.query);

    if (shouldRequestApproval) {
      const approvalId = randomUUID();
      await checkpointStore?.save(runId, {
        runId,
        agentId: input.agentId,
        sessionId,
        proposedArtifact: {
          kind: 'draft',
          ref: 'pending-write-action',
          url: undefined,
        },
        status: 'awaiting_approval',
      });

      yield {
        type: 'approval_request',
        data: {
          runId,
          approvalId,
          reason: 'This action may modify external systems and requires approval.',
          effect: 'write',
        },
      };

      return;
    }

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
      data: { runId, seq: nextSeq(), node: 'langgraph', phase: 'exit' },
    };

    yield {
      type: 'done',
      data: { runId, sessionId },
    };
  }

  async *resume(
    runId: string,
    decision: ApprovalDecision,
    ctx: RunContext,
  ): AsyncIterable<AgentEvent> {
    const state = await ctx.checkpointStore?.load<{
      runId: string;
      sessionId?: string;
      status?: string;
      proposedArtifact?: { kind: string; ref?: string; url?: string };
    }>(runId);

    if (!state) {
      yield {
        type: 'error',
        data: { runId, message: `No checkpoint found for run '${runId}'` },
      };
      return;
    }

    if (decision.status === 'rejected') {
      yield {
        type: 'error',
        data: {
          runId,
          message: decision.note ?? 'Write action was rejected during approval',
        },
      };
      return;
    }

    const artifact = state.proposedArtifact ?? {
      kind: 'change',
      ref: 'approved-action',
    };

    yield {
      type: 'step',
      data: { runId, seq: 1, node: 'approval.resume', phase: 'enter' },
    };

    yield {
      type: 'artifact',
      data: {
        runId,
        kind: artifact.kind,
        ref: artifact.ref,
        url: artifact.url,
      },
    };

    await ctx.checkpointStore?.save(runId, {
      ...state,
      status: 'done',
      resumedAt: new Date().toISOString(),
    });

    yield {
      type: 'step',
      data: { runId, seq: 2, node: 'approval.resume', phase: 'exit' },
    };

    yield {
      type: 'done',
      data: { runId, sessionId: state.sessionId },
    };
  }
}

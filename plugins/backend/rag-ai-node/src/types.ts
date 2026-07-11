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
import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseLLM } from '@langchain/core/language_models/llms';
import { LoggerService } from '@backstage/backend-plugin-api';

export type SourceId = string;

export type EmbeddingsSource = SourceId;

export type SourceDescriptor = {
  id: SourceId;
  description?: string;
};

export interface SourceRegistry {
  register(source: SourceDescriptor): void;
  list(): SourceDescriptor[];
  has(id: SourceId): boolean;
}

export type EmbeddingDocMetadata = Partial<{
  source: EmbeddingsSource;
  [key: string]: string;
}>;

export type EntityFilterShape =
  | Record<string, string | symbol | (string | symbol)[]>[]
  | Record<string, string | symbol | (string | symbol)[]>
  | undefined;

export type Embedding = {
  metadata: EmbeddingDocMetadata;
  content: string;
  vector: number[];
  id: string;
};

export type EmbeddingDoc = {
  metadata: EmbeddingDocMetadata;
  content: string;
};

export interface AugmentationIndexer {
  vectorStore: VectorStore;
  createEmbeddings(
    source: EmbeddingsSource,
    filter?: EntityFilterShape,
  ): Promise<number>;
  deleteEmbeddings(
    source: EmbeddingsSource,
    filter: EntityFilterShape,
  ): Promise<void>;
}

export interface RetrievalRouter {
  determineRetriever(
    query: string,
    source: EmbeddingsSource,
  ): Promise<AugmentationRetriever[]>;
}

export interface AugmentationRetriever {
  id: string;
  retrieve(
    query: string,
    source: EmbeddingsSource,
    filter?: EntityFilterShape,
  ): Promise<EmbeddingDoc[]>;
}

export interface AugmentationPostProcessor {
  process(
    query: string,
    source: EmbeddingsSource,
    embeddingDocs: Map<string, EmbeddingDoc[]>,
  ): Promise<EmbeddingDoc[]>;
}

export interface RetrievalPipeline {
  retrieveAugmentationContext(
    query: string,
    source: EmbeddingsSource,
    filter?: EntityFilterShape,
  ): Promise<EmbeddingDoc[]>;
}

type DeletionParams = {
  ids?: string[];
  filter?: EmbeddingDocMetadata;
};

export interface VectorStore {
  connectEmbeddings(embeddings: Embeddings): void;
  addDocuments(docs: EmbeddingDoc[]): Promise<void>;
  deleteDocuments(deletionParams: DeletionParams): Promise<void>;
  similaritySearch(
    query: string,
    filter?: EmbeddingDocMetadata,
    amount?: number,
  ): Promise<EmbeddingDoc[]>;
}

export type ModelDefinition = {
  id: string;
  model: BaseLLM | BaseChatModel;
};

export type TriggerBinding = {
  id: string;
  source?: string;
  agentId?: string;
};

export type AgentDefinition = {
  id: string;
  modelRef: string;
  systemPrompt: string;
  toolIds: string[];
  orchestrator?: 'single-shot' | 'langgraph' | 'crew';
  memory?: 'none' | 'session';
  crew?: {
    roles: {
      id: string;
      systemPrompt: string;
      modelRef?: string;
      toolIds?: string[];
    }[];
  };
  triggers?: TriggerBinding[];
};

export type ToolContext = {
  credentials?: unknown;
  auth?: unknown;
  discovery?: unknown;
  logger: LoggerService;
  identity: string;
  runId: string;
  signal: AbortSignal;
};

export interface Tool<A = unknown, R = unknown> {
  id: string;
  description?: string;
  schema?: unknown;
  invoke(args: A, ctx: ToolContext): Promise<R>;
  effect?: 'read' | 'write';
}

export interface ToolRegistry {
  register(tool: Tool): void;
  get(id: string): Tool | undefined;
  list(): Tool[];
}

export type ToolDefinition = Tool & {
  augmentationIndexer?: AugmentationIndexer;
  retrievalPipeline?: RetrievalPipeline;
};

export type AgentRunInput = {
  runId: string;
  agentId: string;
  idempotencyKey?: string;
  trigger?: string;
  input: {
    query: string;
    source: SourceId;
    sessionId?: string;
    entityFilter?: EntityFilterShape;
  };
};

export type SessionMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  createdAt?: string;
};

export interface SessionStore {
  createSession(agentId: string, userRef?: string): Promise<string>;
  appendMessage(sessionId: string, message: SessionMessage): Promise<void>;
  listMessages(sessionId: string, limit?: number): Promise<SessionMessage[]>;
}

export interface CheckpointStore {
  save(runId: string, state: unknown): Promise<void>;
  load<T = unknown>(runId: string): Promise<T | undefined>;
}

export type RunRecord = {
  id: string;
  agentId: string;
  sessionId?: string;
  status: 'running' | 'paused' | 'done' | 'error';
  trigger?: string;
  idempotencyKey?: string;
};

export type RunStepRecord = {
  seq: number;
  type: string;
  payload: unknown;
};

export type Artifact = {
  id: string;
  runId: string;
  kind: string;
  ref?: string;
  url?: string;
};

export interface ArtifactSink {
  record(artifact: Artifact): Promise<void>;
}

export type AuditLogEntry = {
  id: string;
  runId: string;
  agentId: string;
  action: string;
  toolId?: string;
  payload?: unknown;
  actor?: string;
};

export interface AuditLogSink {
  recordWriteAction(entry: AuditLogEntry): Promise<void>;
}

export type ApprovalDecision = {
  status: 'approved' | 'rejected';
  note?: string;
  decidedBy?: string;
};

export type ApprovalRequest = {
  id: string;
  runId: string;
  reason: string;
  effect: 'read' | 'write';
};

export interface RunStore {
  createRun(record: RunRecord): Promise<void>;
  getRun(runId: string): Promise<RunRecord | undefined>;
  findRunByIdempotencyKey(key: string): Promise<RunRecord | undefined>;
  updateRunStatus(runId: string, status: RunRecord['status']): Promise<void>;
  appendRunStep(runId: string, seq: number, type: string, payload: unknown): Promise<void>;
  listRunSteps(runId: string, sinceSeq?: number): Promise<RunStepRecord[]>;
  createApproval(request: ApprovalRequest): Promise<void>;
  getPendingApproval(runId: string): Promise<ApprovalRequest | undefined>;
  decideApproval(runId: string, decision: ApprovalDecision): Promise<void>;
}

export type RunContext = {
  logger: LoggerService;
  toolRegistry: ToolRegistry;
  model: BaseLLM | BaseChatModel;
  systemPrompt?: string;
  identity?: string;
  signal?: AbortSignal;
  sessionStore?: SessionStore;
  checkpointStore?: CheckpointStore;
  runStore?: RunStore;
  artifactSink?: ArtifactSink;
  auditLogSink?: AuditLogSink;
  hardening?: {
    timeoutMs?: number;
    maxRetries?: number;
    retryBackoffMs?: number;
    maxTotalTokens?: number;
  };
  memory?: 'none' | 'session';
};

export type AgentEvent =
  | {
      type: 'step';
      data: { runId: string; seq: number; node: string; phase: 'enter' | 'exit' };
    }
  | { type: 'token'; data: { runId: string; text: string } }
  | { type: 'tool_call'; data: { runId: string; tool: string; args: unknown } }
  | {
      type: 'tool_result';
      data: {
        runId: string;
        tool: string;
        ok: boolean;
        summary?: string;
        output?: unknown;
      };
    }
  | {
      type: 'usage';
      data: { runId: string; input: number; output: number; total: number };
    }
  | {
      type: 'approval_request';
      data: { runId: string; approvalId: string; reason: string; effect: 'read' | 'write' };
    }
  | {
      type: 'artifact';
      data: { runId: string; kind: string; url?: string; ref?: string };
    }
  | { type: 'done'; data: { runId: string; sessionId?: string } }
  | { type: 'error'; data: { runId: string; message: string } };

export interface Orchestrator {
  run(input: AgentRunInput, ctx: RunContext): AsyncIterable<AgentEvent>;
  resume?(
    runId: string,
    decision: ApprovalDecision,
    ctx: RunContext,
  ): AsyncIterable<AgentEvent>;
}

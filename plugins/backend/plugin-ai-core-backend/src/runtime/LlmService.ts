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
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseLLM } from '@langchain/core/language_models/llms';
import { AIMessageChunk } from '@langchain/core/messages';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import { LoggerService } from '@backstage/backend-plugin-api';
import { EmbeddingDoc } from '@webstackbuilders/plugin-ai-core-node';
import { createPromptTemplates } from '../tools';

/**
 * Minimal adapter that converts retrieval context + question into a streamed
 * model invocation payload.
 *
 * Prompt assembly is centralized here so orchestrators can reuse identical
 * prompt policy behavior regardless of execution style.
 */
export class LlmService {
  private readonly logger: LoggerService;
  private readonly configuredPrompts?: {
    prefix?: string;
    suffix?: string;
  };

  constructor({
    logger,
    configuredPrompts,
  }: {
    logger: LoggerService;
    configuredPrompts?: {
      prefix?: string;
      suffix?: string;
    };
  }) {
    this.logger = logger;
    this.configuredPrompts = configuredPrompts;
  }

  /**
   * Streams model output for a composed RAG prompt built from embeddings and query.
   */
  async query(
    embeddings: EmbeddingDoc[],
    query: string,
    options: {
      model: BaseLLM | BaseChatModel;
      systemPrompt?: string;
    },
  ): Promise<IterableReadableStream<string | AIMessageChunk>> {
    this.logger.info('Starting to prompt LLM.');

    const prompts = createPromptTemplates({
      prefix: options.systemPrompt ?? this.configuredPrompts?.prefix,
      suffix: this.configuredPrompts?.suffix,
    });

    const promptEmbeddings = embeddings
      .map(embedding => embedding.content)
      .join('\n');

    const prompt = `Human:\n${prompts.prefixPrompt(
      promptEmbeddings,
    )}\n ---\n${prompts.suffixPrompt(query)}\nAssistant:`;

    return options.model.stream(prompt) as Promise<
      IterableReadableStream<string | AIMessageChunk>
    >;
  }
}

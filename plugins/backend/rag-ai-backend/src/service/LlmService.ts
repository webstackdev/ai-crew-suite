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
import { BaseLLM } from '@langchain/core/language_models/llms';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessageChunk } from '@langchain/core/messages';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import { EmbeddingDoc } from '@webstackbuilders/plugin-ai-core-node';
import { LoggerService } from '@backstage/backend-plugin-api';
import { createPromptTemplates } from './prompts';

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

/*
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
import { BaseMessage, AIMessageChunk } from '@langchain/core/messages';
import { ChatResult } from '@langchain/core/outputs';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';

/** A scripted response the FakeChatModel emits in sequence. */
export type FakeModelScript = {
  /** Full text emitted for this step. */
  text: string;
  /** Token usage reported for this step. */
  usage?: { input: number; output: number; total: number };
};

/**
 * Deterministic chat model for tests. Emits scripted responses in order, with
 * `usage_metadata`, so byte-identical replay is assertable across runs.
 */
export class FakeChatModel extends BaseChatModel {
  private steps: FakeModelScript[];
  private index = 0;

  constructor(steps: FakeModelScript[] = []) {
    super({});
    this.steps = [...steps];
  }

  /** Queue additional scripted steps. */
  queue(step: FakeModelScript): void {
    this.steps.push(step);
  }

  _llmType(): string {
    return 'fake-chat-model';
  }

  async _generate(
    _messages: BaseMessage[],
    _options?: this['ParsedCallOptions'],
    _runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    const step = this.steps[Math.min(this.index, this.steps.length - 1)] ?? { text: '' };
    this.index += 1;
    const chunk = new AIMessageChunk({
      content: step.text,
      usage_metadata: step.usage
        ? {
            input_tokens: step.usage.input,
            output_tokens: step.usage.output,
            total_tokens: step.usage.total,
          }
        : undefined,
    });
    return {
      generations: [{ message: chunk, text: step.text }],
      llmOutput: {},
    };
  }
}

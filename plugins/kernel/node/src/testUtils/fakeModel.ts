/*
 * Copyright 2026 The AI Crew Suite Authors
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
import { BaseChatModel, BaseChatModelParams } from '@langchain/core/language_models/chat_models';
import { BaseMessage, AIMessageChunk } from '@langchain/core/messages';
import { ChatResult, ChatGenerationChunk } from '@langchain/core/outputs';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';

/**
 * Represents a predefined step script payload that the mock chat model executes in sequence.
 */
export type FakeModelScript = {
  /** The text content to be returned by the model for this step. */
  text: string;
  /** Optional metadata recording specific token consumption metrics. */
  usage?: { input: number; output: number; total: number };
};

/**
 * Captures an immutable trace record of an incoming execution pass for downstream test verification.
 */
export type FakeModelCallTrace = {
  /** The collection of input messages passed into the model invocation call. */
  messages: BaseMessage[];
  /** Execution configurations and additional parameter overrides provided to this call. */
  options: Record<string, any>;
};

/**
 * A highly deterministic, scriptable chat model utility designed exclusively for unit tests.
 *
 * It yields sequential, mock response chunks in order of insertion, complete with 
 * artificial `usage_metadata`. This layout allows assertion tracking for token usage, replay scenarios, 
 * and conversational branching behavior without issuing requests to external AI vendors.
 *
 * Additionally, it exposes an historical audit trail array tracking all inbound calls to support 
 * thorough option validation and regression testing across enterprise runtime environments.
 *
 * Supports both standard generations (`.invoke()`, `.generate()`) and streamed generation chunks (`.stream()`).
 */
export class FakeChatModel extends BaseChatModel {
  /** The sequence array storing future scripted responses. */
  private steps: FakeModelScript[];

  /** Internal iteration tracker cursor. */
  private index = 0;

  /**
   * Enterprise Inspection Vector: Stores an audit trail of all incoming calls 
   * made to this instance during a test execution lifecycle.
   */
  public readonly calls: FakeModelCallTrace[] = [];

  /**
   * Initializes a new instance of the FakeChatModel with an optional set of scripted responses.
   *
   * @param steps - Initial array of mock responses to emit in order.
   * @param fields - Optional standard LangChain parameters to pass down to the underlying `BaseChatModel`.
   */
  constructor(steps: FakeModelScript[] = [], fields?: BaseChatModelParams) {
    super(fields ?? {});
    this.steps = [...steps];
  }

  /**
   * Queues an additional scripted response step onto the tail of the validation sequence array.
   *
   * @param step - The next script step object containing text and optional token usage profiles.
   * @returns void
   */
  public queue(step: FakeModelScript): void {
    this.steps.push(step);
  }

  /**
   * Returns the tracking string identifier representing this custom mock model type.
   * Required by the internal LangChain registration interface.
   *
   * @returns The string 'fake-chat-model'.
   */
  public override _llmType(): string {
    return 'fake-chat-model';
  }

  /**
   * Core generator loop mapping inbound execution requests to the active step script item.
   * Automatically advances the internal execution index marker upon invocation.
   *
   * @param messages - Intercepted conversation state array used during execution.
   * @param options - Parameter execution variations passed down during model runtime invocation.
   * @param _runManager - Optional callback managers to bubble lifecycle telemetry events upward.
   * @returns A promise resolving to a structured `ChatResult` completion payload.
   */
  public override async _generate(
    messages: BaseMessage[],
    options?: this['ParsedCallOptions'],
    _runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    this.calls.push({ messages, options: options ?? {} });

    const step = this.getCurrentStepAndAdvance();
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

  /**
   * Implements streaming chunk outputs to support mock execution testing over stream boundaries.
   * Async generator sequentially returns a single complete token chunk containing the text step data.
   *
   * @param messages - Intercepted conversation state array used during execution.
   * @param options - Parameter execution variations passed down during model runtime invocation.
   * @param _runManager - Optional callback managers to bubble lifecycle telemetry events upward.
   * @returns An asynchronous iterable stream yielding `ChatGenerationChunk` fragments.
   */
  public override async *_streamResponseChunks(
    messages: BaseMessage[],
    options?: this['ParsedCallOptions'],
    _runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    this.calls.push({ messages, options: options ?? {} });

    const step = this.getCurrentStepAndAdvance();
    yield new ChatGenerationChunk({
      text: step.text,
      message: new AIMessageChunk({
        content: step.text,
        usage_metadata: step.usage
          ? {
              input_tokens: step.usage.input,
              output_tokens: step.usage.output,
              total_tokens: step.usage.total,
          }
          : undefined,
      }),
    });
  }

  /**
   * Safe utility extractor targeting the active script array slice.
   * Caps execution cursor ranges gracefully when elements are depleted.
   *
   * @returns The active `FakeModelScript` block configuration or an empty text fallback.
   */
  private getCurrentStepAndAdvance(): FakeModelScript {
    if (this.steps.length === 0) {
      return { text: '' };
    }
    const activeIndex = Math.min(this.index, this.steps.length - 1);
    const step = this.steps[activeIndex] ?? { text: '' };
    this.index += 1;
    return step;
  }
}

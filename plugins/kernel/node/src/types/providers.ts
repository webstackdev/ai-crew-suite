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
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * Registers a chat model that agents can reference by ID. BaseChatModel only —
 * legacy BaseLLM string-prompt support is removed across the platform.
 */
export type ChatModelDefinition = {
  /** Unique model identifier used by agent definitions and tiers. */
  id: string;
  /** LangChain chat model instance used for generation. */
  model: BaseChatModel;
};

/**
 * Registers a speech-to-text transcription provider (Whisper-style).
 */
export type TranscriptionDefinition = {
  /** Unique provider identifier. */
  id: string;
  /** Translates raw binary audio arrays into structured text summaries. */
  transcribe(input: {
    audio: Uint8Array;
    mimeType?: string;
  }): Promise<{ text: string }>;
};

/**
 * Registers a safety classifier (Llama Guard, Bedrock Guardrails, Azure Content
 * Safety, OpenAI Moderation). The contract is uniform so the engine can block
 * uniformly; provider-specific configuration lives in the provider module.
 */
export type GuardrailDefinition = {
  /** Unique provider identifier. */
  id: string;
  /** Classifies incoming prompts or outbound egress text to catch violations. */
  classify(input: {
    text: string;
    direction: 'input' | 'output';
  }): Promise<{
    verdict: 'safe' | 'unsafe';
    categories?: string[];
    message?: string;
  }>;
};

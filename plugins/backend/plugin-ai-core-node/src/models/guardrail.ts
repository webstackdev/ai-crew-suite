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

/**
 * Registers a safety classifier (Llama Guard, Bedrock Guardrails, Azure Content
 * Safety, OpenAI Moderation). The contract is uniform so the engine can block
 * uniformly; provider-specific configuration lives in the provider module.
 */
export type GuardrailDefinition = {
  /** Unique provider identifier. */
  id: string;
  classify(input: {
    text: string;
    direction: 'input' | 'output';
  }): Promise<{
    verdict: 'safe' | 'unsafe';
    categories?: string[];
    message?: string;
  }>;
};

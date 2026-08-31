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

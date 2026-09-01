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
export interface Config {
  ai?: {
    /** Fallback values used when a specific agent does not provide overrides. */
    defaults?: {
      /** Default agent ID used when a request does not explicitly select one. */
      agent?: string;
      /** Default model reference (for example, `gpt-4o` or `claude-3-5-sonnet`). */
      model?: string;
      /** Default system prompt applied when no agent-specific prompt is configured. */
      systemPrompt?: string;
    };

    /** Per-agent execution settings keyed by agent ID. */
    agents?: Record<
      string,
      {
        /** Model override for this agent. */
        model?: string;
        /** System prompt override for this agent. */
        systemPrompt?: string;
        /**
         * Orchestration strategy used to execute this agent.
         * - `single-shot`: One-pass retrieval and response.
         * - `langgraph`: Stateful graph-based orchestration.
         * - `crew`: Sequential multi-role collaboration.
         */
        orchestrator?: 'single-shot' | 'langgraph' | 'crew';
        /** Tool IDs that this agent is allowed to use. */
        tools?: string[];
        /**
         * Memory mode for this agent.
         * - `none`: Stateless execution.
         * - `session`: Persist conversational state per session.
         */
        memory?: 'none' | 'session';
        /** Crew role definitions, used only when `orchestrator` is `crew`. */
        crew?: {
          /** Ordered role list executed by the crew orchestrator. */
          roles: {
            /** Unique role identifier (for example, `security-auditor`). */
            id: string;
            /** System prompt that defines this role's behavior. */
            systemPrompt: string;
            /** Optional model override for this role. */
            model?: string;
            /** Optional tool IDs available only to this role. */
            tools?: string[];
          }[];
        };
      }
    >;

    /** Prompt wrappers applied to generated execution prompts. */
    prompts?: {
      /** Text prepended before the generated prompt body. */
      prefix: string;
      /** Text appended after the generated prompt body. */
      suffix: string;
    };

    /** Allowed retrieval source IDs (for example, `techdocs` or `confluence`). */
    supportedSources?: string[];

    /** Runtime hardening limits for timeout, retries, token budget, and rate control. */
    hardening?: {
      /** Request timeout in milliseconds. */
      timeoutMs?: number;
      /** Maximum retry attempts for transient failures. */
      maxRetries?: number;
      /** Base backoff delay in milliseconds between retries. */
      retryBackoffMs?: number;
      /** Maximum total tokens allowed per request lifecycle. */
      maxTotalTokens?: number;
      /** Maximum allowed requests per rolling minute window. */
      rateLimitPerMinute?: number;
    };
  };
}

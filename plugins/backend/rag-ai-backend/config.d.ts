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

export interface Config {
  /**
   * AI backend configuration
   */
  ai?: {
    /**
     * Global defaults that are inherited by individual agent configs.
     */
    defaults?: {
      /**
       * Default model reference used when an agent does not specify one.
       */
      model?: string;

      /**
       * Default system prompt used when an agent does not specify one.
       */
      systemPrompt?: string;

      /**
       * Default agent id for requests that do not specify one.
       */
      agent?: string;
    };

    /**
     * Optional agent-specific overrides.
     */
    agents?: Record<
      string,
      {
        model?: string;
        systemPrompt?: string;
        orchestrator?: 'single-shot' | 'langgraph' | 'crew';
        tools?: string[];
        memory?: 'none' | 'session';
        crew?: {
          roles: {
            id: string;
            systemPrompt: string;
            model?: string;
            tools?: string[];
          }[];
        };
      }
    >;

    /**
     * Legacy prompt template configuration, now treated as default prompt input.
     */
    prompts?: {
      prefix: string;
      suffix: string;
    };

    /**
     * Supported sources to query information from using RAG.
     */
    supportedSources?: string[];

    /**
     * Source ids available to the source registry.
     */
    sources?: string[];
  };
}

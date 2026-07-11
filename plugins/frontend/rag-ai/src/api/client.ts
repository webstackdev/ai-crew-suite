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
import {
  ConfigApi,
  DiscoveryApi,
  FetchApi,
  IdentityApi,
} from '@backstage/core-plugin-api';
import { RagAiApi } from './ragApi';
import { AiRunEvent } from '../types';
import {
  EventSourceParserStream,
  ParsedEvent,
} from 'eventsource-parser/stream';

export class RagAiClient implements RagAiApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;
  private readonly configApi: ConfigApi;
  private baseUrl?: string;
  private readonly identityApi: IdentityApi;

  constructor(options: {
    discoveryApi: DiscoveryApi;
    fetchApi: FetchApi;
    configApi: ConfigApi;
    identityApi: IdentityApi;
  }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
    this.configApi = options.configApi;
    this.identityApi = options.identityApi;
  }

  private async getBaseUrl(): Promise<string> {
    if (!this.baseUrl) {
      const endpointPath = this.configApi.getOptionalString('ai.endpointPath');
      this.baseUrl = await this.discoveryApi.getBaseUrl(
        endpointPath ?? 'rag-ai',
      );
    }
    return this.baseUrl;
  }

  private async fetch(path: string, options: {} = {}) {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/${path}`, options);

    if (!response.ok)
      throw new Error(`Failed to retrieved data from path ${path}`);

    return response.body!;
  }

  async *ask(
    question: string,
    source: string,
    agentId?: string,
  ): AsyncGenerator<AiRunEvent> {
    const { token } = await this.identityApi.getCredentials();

    try {
      const stream = await this.fetch(`query/${source}`, {
        body: JSON.stringify({
          query: question,
          agentId,
        }),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (stream) {
        const reader = stream
          .pipeThrough(new TextDecoderStream())
          .pipeThrough(new EventSourceParserStream())
          .getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const parsed = this.toRunEvent(value);
          if (parsed) {
            yield parsed;
          }
        }
      } else {
        yield {
          type: 'error',
          data: {
            runId: 'unknown',
            message: 'No response received from the LLM',
          },
        };
      }
    } catch (e: any) {
      // eslint-disable-next-line
      console.error(e.message);
      yield {
        type: 'error',
        data: {
          runId: 'unknown',
          message: `Failed to complete query due to error: ${e.message}`,
        },
      };
    }
  }

  private toRunEvent(event: ParsedEvent): AiRunEvent | undefined {
    switch (event.event) {
      case 'step':
      case 'token':
      case 'tool_call':
      case 'tool_result':
      case 'usage':
      case 'done':
      case 'error': {
        try {
          return {
            type: event.event,
            data: JSON.parse(event.data),
          } as AiRunEvent;
        } catch {
          if (event.event === 'error') {
            return {
              type: 'error',
              data: { runId: 'unknown', message: event.data || 'Unknown error' },
            };
          }
          return undefined;
        }
      }
      case 'response': {
        return {
          type: 'token',
          data: {
            runId: 'unknown',
            text: event.data,
          },
        };
      }
      case 'embeddings': {
        try {
          return {
            type: 'tool_result',
            data: {
              runId: 'unknown',
              tool: 'knowledge.retrieve',
              ok: true,
              output: { embeddings: JSON.parse(event.data) },
            },
          };
        } catch {
          return undefined;
        }
      }
      default:
        return undefined;
    }
  }
}

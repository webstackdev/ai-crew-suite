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
import { EventSourceParserStream, type ParsedEvent } from 'eventsource-parser/stream';
import type {
  AiErrorEvent,
  BaseAiAgentClientOptions,
  MasterAiRunEvent,
} from '../@types';

export abstract class BaseAiAgentClient<TEvent extends MasterAiRunEvent = MasterAiRunEvent> {
  private baseUrl?: string;

  /**
   * The list of explicit event types this client instance expects to receive.
   * Child classes pass their specific subset here to lock down the parsing firewall.
   */
  protected abstract readonly allowedEventTypes: TEvent['type'][];

  constructor(protected readonly options: BaseAiAgentClientOptions) {}

  /** Shared method used across all streaming agent clients */
  async *streamRunEvents(runId: string, lastEventId?: number): AsyncGenerator<TEvent | AiErrorEvent> {
    yield* this.read(
      await this.fetchStream(`runs/${runId}/events`, {
        method: 'GET',
        headers: {
          ...(await this.authHeaders()),
          ...(lastEventId === undefined ? {} : { 'Last-Event-ID': String(lastEventId) }),
        },
      })
    );
  }

  /**
   * Pattern 1: Generic Handler for creating agent execution runs
   */
  protected async *executeAgentRun<TInput extends Record<string, any>>(
    agentId: string,
    input: AgentInput<TInput> | TInput,
    wrapInQuery: boolean = true
  ): AsyncGenerator<AiRunEvent> {
    const headers = await this.getHeaders();
    
    // Construct standard wrapping object
    const requestPayload = {
      version: 1,
      source: 'manual',
      ...input,
    };

    // Account for variations where the prompt payload is structured inside a nested query block
    const bodyContent = wrapInQuery
      ? { input: { query: JSON.stringify(requestPayload) } }
      : { input: requestPayload };

    const stream = await this.fetchStream(`agents/${agentId}/runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(bodyContent),
    });

    yield* this.read(stream);
  }

  /**
   * Pattern 2: Generic Handler for run approvals
   */
  protected async *executeApprovalSubmit(
    runId: string, 
    decision: ApprovalDecision
  ): AsyncGenerator<AiRunEvent> {
    const stream = await this.fetchStream(`runs/${runId}/approvals`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await this.getHeaders()),
      },
      body: JSON.stringify(decision),
    });

    yield* this.read(stream);
  }

  protected async authHeaders(): Promise<Record<string, string>> {
    const { token } = await this.options.identityApi.getCredentials();
    return token ? { authorization: `Bearer ${token}` } : {};
  }

  protected async getBaseUrl(): Promise<string> {
    if (!this.baseUrl) {
      this.baseUrl = await this.options.discoveryApi.getBaseUrl(
        this.options.configApi.getOptionalString('ai.endpointPath') ?? 'ai-core'
      );
    }
    return this.baseUrl;
  }

  protected async fetchStream(path: string, options: RequestInit): Promise<ReadableStream> {
    const response = await this.options.fetchApi.fetch(
      `${await this.getBaseUrl()}/${path}`,
      options
    );

    if (!response.ok) {
      throw new Error(`Failed to retrieve data from path ${path}`);
    }
    if (!response.body) {
      throw new Error(`No stream available from path ${path}`);
    }

    return response.body;
  }

  protected async *read(stream: ReadableStream): AsyncGenerator<TEvent | AiErrorEvent> {
    try {
      const reader = stream
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())
        .getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) return;

        const event = this.toRunEvent(value);
        if (event) {
          yield event;
        }
      }
    } catch (error) {
      yield {
        type: 'error',
        data: {
          runId: 'unknown',
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  protected toRunEvent(event: ParsedEvent): TEvent | AiErrorEvent | undefined {
    // Treat 'error' as an implicit global core event type so stream disruptions can map to types cleanly
    const isCoreError = event.event === 'error';
    const isPluginEvent = (this.allowedEventTypes as (string | undefined)[]).includes(event.event);

    if (!isPluginEvent && !isCoreError) return undefined;

    try {
      return {
        type: event.event,
        data: JSON.parse(event.data ?? '{}'),
      } as TEvent | AiErrorEvent;
    } catch {
      return isCoreError
        ? {
            type: 'error',
            data: {
              runId: 'unknown',
              message: event.data || 'Unknown error'
            }
          }
        : undefined;
    }
  }
}

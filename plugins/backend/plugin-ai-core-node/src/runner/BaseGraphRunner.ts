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
import { z } from 'zod';
import { InputError } from '@backstage/errors';
import {
  WorkflowRunner,
  AgentRunInput,
  WorkflowContext,
  AgentEvent
} from '../@types';

/**
 * Universal Base Graph Class to enforce defensive contract parsing at the runtime
 * engine entrypoint. All agentic workflow plugins inherit from this class.
 */
export abstract class BaseGraphRunner<TSchema extends z.ZodType> implements WorkflowRunner {
  /** Stable ID referenced by `AgentDefinition.workflowRef`. */
  abstract readonly id: string;

  /**
   * Initializes the runner with its designated structural schema validation rules.
   */
  constructor(protected readonly inputSchema: TSchema) {}

  /**
   * Internal specialized node execution block overridden by individual agent graph scripts.
   * Receives a fully sanitized, strongly typed input configuration payload automatically.
   */
  protected abstract executeGraph(
    validatedInput: z.infer<TSchema>,
    inputEnvelope: AgentRunInput,
    context: WorkflowContext
  ): AsyncIterable<AgentEvent>;

  /**
   * Primary framework execution engine contract point satisfying the core WorkflowRunner
   * interface.
   */
  public async *run(input: AgentRunInput, context: WorkflowContext): AsyncIterable<AgentEvent> {
    try {
      if (!input.input?.query) {
        throw new InputError('Invalid platform invocation payload. Missing "input.query" parameter fields.');
      }

      // 1. Safely unbox the natural-language task query string block
      const rawQuery = typeof input.input.query === 'string'
        ? JSON.parse(input.input.query)
        : input.input.query;

      // 2. Execute strict verification of validation schema constraints
      const validation = this.inputSchema.safeParse(rawQuery);

      if (!validation.success) {
        throw new InputError(`Defensive Validation Guard Blocked Workflow [${this.id}]: ${validation.error.message}`);
      }

      // 3. Hand cleanly sanitized arguments down-funnel to graph execution routine
      yield* this.executeGraph(validation.data, input, context);

    } catch (error) {
      // Map unexpected system exceptions to core streaming AgentEvent error format
      yield {
        type: 'error',
        data: {
          runId: input.runId,
          message: error instanceof Error ? error.message : String(error)
        }
      } as any; // Cast safely to fulfill the event stream signature
    }
  }

  /**
   * Optional platform pass-through mapping hook for human authorization checkpoints.
   */
  public resume?(
    runId: string,
    decision: any,
    context: WorkflowContext
  ): AsyncIterable<AgentEvent> {
    throw new Error(`Resume capability is not configured natively on workflow runner agent [${this.id}].`);
  }
}

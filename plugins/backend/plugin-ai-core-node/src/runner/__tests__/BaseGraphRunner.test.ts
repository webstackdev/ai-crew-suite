
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { BaseGraphRunner } from '../BaseGraphRunner';
import { AgentRunInput, WorkflowContext, AgentEvent } from '../../@types/run';

const MockInputSchema = z.object({
  targetService: z.string().min(1, 'Target service is required'),
  maxRetries: z.number().int().positive().optional(),
}).strict();

type MockInput = z.infer<typeof MockInputSchema>;

class TestGraphRunner extends BaseGraphRunner<typeof MockInputSchema> {
  readonly id = 'test-mock-workflow';

  constructor() {
    super(MockInputSchema);
  }

  protected async *executeGraph(
    validatedInput: MockInput,
    inputEnvelope: AgentRunInput,
    context: WorkflowContext
  ): AsyncIterable<AgentEvent> {
    yield {
      type: 'step',
      data: { runId: inputEnvelope.runId, seq: 1, node: 'init', phase: 'enter' },
    } as AgentEvent;

    if (validatedInput.targetService === 'TRIGGER_FAILURE') {
      throw new Error('Simulated runtime node failure exception');
    }

    yield {
      type: 'done',
      data: { runId: inputEnvelope.runId },
    } as AgentEvent;
  }
}

const createMockContext = (): WorkflowContext => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
} as unknown as WorkflowContext);

const createInputEnvelope = (queryPayload: unknown): AgentRunInput => ({
  runId: 'run-abc-123',
  agentId: 'test-mock-workflow',
  input: {
    query: typeof queryPayload === 'string' ? queryPayload : JSON.stringify(queryPayload),
    source: 'catalog',
  },
} as AgentRunInput);

const collectEvents = async (stream: AsyncIterable<AgentEvent>) => {
  const events: AgentEvent[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
};

describe('BaseGraphRunner Isolation Verification Suite', () => {
  const runner = new TestGraphRunner();
  const context = createMockContext();

  it('unboxes and executes workflows successfully when payloads match the strict Zod rules', async () => {
    const validPayload = { targetService: 'auth-service', maxRetries: 3 };
    const envelope = createInputEnvelope(validPayload);

    const events = await collectEvents(runner.run(envelope, context));

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: 'step',
      data: { node: 'init', phase: 'enter', runId: 'run-abc-123' },
    });
    expect(events[1]).toMatchObject({
      type: 'done',
      data: { runId: 'run-abc-123' },
    });
  });

  it('supports unboxing pre-parsed object blocks directly if bypassing the serialization boundary', async () => {
    const envelope = createInputEnvelope({ targetService: 'payment-gateway' });
    // @ts-expect-error - input.query expects a string at runtime, but we are injecting an object literal for this test
    envelope.input.query = { targetService: 'payment-gateway' };

    const events = await collectEvents(runner.run(envelope, context));

    expect(events[0]).toMatchObject({ type: 'step' });
    expect(events[1]).toMatchObject({ type: 'done' });
  });

  it('shields downstream graphs by mapping Zod compilation anomalies to standard core error event packages', async () => {
    // Missing required field: targetService
    const brokenPayload = { maxRetries: 5 };
    const envelope = createInputEnvelope(brokenPayload);

    const events = await collectEvents(runner.run(envelope, context));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'error',
      data: {
        runId: 'run-abc-123',
        // FIX: Match the exact default token array structure emitted by Zod
        message: expect.stringContaining('invalid_type'),
      },
    });
  });

  it('enforces strict boundary validation and bars unexpected configuration parameter pollution', async () => {
    const pollutedPayload = { targetService: 'catalog-service', maliciousPayloadInjected: true };
    const envelope = createInputEnvelope(pollutedPayload);

    const events = await collectEvents(runner.run(envelope, context));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'error',
      data: {
        runId: 'run-abc-123',
        message: expect.stringContaining('unrecognized_keys'),
      },
    });
  });

  it('intercepts runtime exceptions within executeGraph nodes and handles them gracefully', async () => {
    const errorTriggerPayload = { targetService: 'TRIGGER_FAILURE' };
    const envelope = createInputEnvelope(errorTriggerPayload);

    const events = await collectEvents(runner.run(envelope, context));

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: 'step' });
    expect(events[1]).toMatchObject({
      type: 'error',
      data: {
        runId: 'run-abc-123',
        message: 'Simulated runtime node failure exception',
      },
    });
  });

  it('fails cleanly if the incoming runtime request object block lacks a query payload entirely', async () => {
    const badEnvelope = {
      runId: 'run-err-999',
      input: {},
    } as AgentRunInput;

    const events = await collectEvents(runner.run(badEnvelope, context));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'error',
      data: {
        runId: 'run-err-999',
        message: expect.stringContaining('Missing "input.query" parameter fields'),
      },
    });
  });
});

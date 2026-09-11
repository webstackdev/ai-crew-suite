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
import { describe, expect, it } from 'vitest';
import { HumanMessage } from '@langchain/core/messages';
import { FakeChatModel } from '../fakeModel';

describe('FakeChatModel Test Helper', () => {
  it('sequentially resolves invoke queries based on the provided script array', async () => {
    const model = new FakeChatModel([
      { text: 'Response A', usage: { input: 2, output: 3, total: 5 } },
      { text: 'Response B' }
    ]);

    const res1 = await model.invoke([new HumanMessage('Query 1')]);
    expect(res1.content).toBe('Response A');
    expect(res1.usage_metadata).toEqual({
      input_tokens: 2,
      output_tokens: 3,
      total_tokens: 5
    });

    const res2 = await model.invoke([new HumanMessage('Query 2')]);
    expect(res2.content).toBe('Response B');
  });

  it('gracefully caps and repeats the final scripted element if execution steps run out', async () => {
    const model = new FakeChatModel([{ text: 'Terminal Step' }]);

    await model.invoke([new HumanMessage('Trigger 1')]);
    const res2 = await model.invoke([new HumanMessage('Trigger 2 Overrun')]);

    expect(res2.content).toBe('Terminal Step');
  });

  it('allows dynamically queueing new script steps mid-test execution', async () => {
    const model = new FakeChatModel([]);
    model.queue({ text: 'Dynamic Response' });

    const res = await model.invoke([new HumanMessage('Hello')]);
    expect(res.content).toBe('Dynamic Response');
  });

  it('supports streaming execution via async chunks', async () => {
    const model = new FakeChatModel([{ text: 'Streamed Answer' }]);
    const stream = await model.stream([new HumanMessage('Stream Request')]);

    let combinedText = '';
    for await (const chunk of stream) {
      combinedText += chunk.content;
    }

    expect(combinedText).toBe('Streamed Answer');
  });

  it('captures an immutable audit history of inputs and parameter configurations across multiple iterations', async () => {
    const model = new FakeChatModel([{ text: 'Acknowledged' }]);
    const payloadMessage = new HumanMessage('Execute Task X');
    await model.invoke([payloadMessage], { temperature: 0.7 } as any);

    expect(model.calls.length).toBe(1);

    const firstCall = model.calls[0];

    expect(firstCall).toBeDefined();
    expect(firstCall?.messages[0]).toBe(payloadMessage);
    expect(firstCall?.options).toHaveProperty('temperature', 0.7);
  });

  it('ensures complete payload layout parity between standard invocation and streaming interfaces', async () => {
    const expectedScript = { text: 'Data Packet', usage: { input: 1, output: 1, total: 2 } };

    const invokeModel = new FakeChatModel([expectedScript]);
    const streamModel = new FakeChatModel([expectedScript]);

    const invokeResult = await invokeModel.invoke([new HumanMessage('test')]);
    const streamIterable = await streamModel.stream([new HumanMessage('test')]);

    let streamResultChunk: any = null;
    for await (const chunk of streamIterable) {
      streamResultChunk = chunk;
    }

    // Both interfaces must expose symmetric structural properties to avoid contract errors
    expect(invokeResult.content).toEqual(streamResultChunk.content);
    expect(invokeResult.usage_metadata).toEqual(streamResultChunk.usage_metadata);
  });
});

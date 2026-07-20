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
import { describe, expect, it, vi } from 'vitest';
import { createCollaborationTools } from '../registerTools';
import { CollaborationDriver } from '../../providers';

const createMockDriver = (overrides: Partial<CollaborationDriver> = {}): CollaborationDriver => ({
  providerId: 'mock',
  searchTickets: vi.fn().mockResolvedValue([]),
  getTicket: vi.fn().mockResolvedValue({ id: 'TEST-1', title: 'Test', state: 'open' }),
  lookupChannel: vi.fn().mockResolvedValue(undefined),
  createTicket: vi.fn().mockResolvedValue({ id: 'CREATED-1', title: 'Created', state: 'open' }),
  commentTicket: vi.fn().mockResolvedValue({ author: 'ai', body: 'comment' }),
  postMessage: vi.fn().mockResolvedValue({ messageId: 'msg-1' }),
  ...overrides,
});

const createMockLogger = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

const ctx = {
  logger: createMockLogger() as never,
  identity: 'test-user',
  runId: 'test-run',
  signal: new AbortController().signal,
};

describe('createCollaborationTools', () => {
  it('registers the expected stable tool IDs', () => {
    const tools = createCollaborationTools({
      ticketingDriver: createMockDriver(),
      messagingDriver: createMockDriver(),
      logger: createMockLogger() as never,
    });
    const ids = tools.map(t => t.id);
    expect(ids).toEqual([
      'collaboration.ticket.search',
      'collaboration.ticket.get',
      'collaboration.channel.lookup',
      'collaboration.ticket.create',
      'collaboration.ticket.comment',
      'collaboration.message.post',
    ]);
  });

  it('marks read tools as read and write tools as write', () => {
    const tools = createCollaborationTools({
      ticketingDriver: createMockDriver(),
      messagingDriver: createMockDriver(),
      logger: createMockLogger() as never,
    });
    const readTools = tools.filter(t => t.effect === 'read');
    const writeTools = tools.filter(t => t.effect === 'write');
    expect(readTools).toHaveLength(3);
    expect(writeTools).toHaveLength(3);
  });

  it('collaboration.ticket.search delegates to ticketingDriver', async () => {
    const ticketingDriver = createMockDriver();
    const tools = createCollaborationTools({
      ticketingDriver,
      messagingDriver: createMockDriver(),
      logger: createMockLogger() as never,
    });
    const tool = tools.find(t => t.id === 'collaboration.ticket.search')!;
    await tool.invoke({ query: 'service:api' }, ctx);
    expect(ticketingDriver.searchTickets).toHaveBeenCalledWith('service:api');
  });

  it('collaboration.message.post delegates to messagingDriver', async () => {
    const messagingDriver = createMockDriver();
    const tools = createCollaborationTools({
      ticketingDriver: createMockDriver(),
      messagingDriver,
      logger: createMockLogger() as never,
    });
    const tool = tools.find(t => t.id === 'collaboration.message.post')!;
    const result = await tool.invoke({ channelId: 'C123', message: 'hello' }, ctx);
    expect(messagingDriver.postMessage).toHaveBeenCalledWith('C123', 'hello');
    expect(result).toEqual({ messageId: 'msg-1' });
  });
});

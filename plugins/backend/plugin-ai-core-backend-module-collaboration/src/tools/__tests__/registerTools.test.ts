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
import { mockServices } from '@backstage/backend-test-utils';
import {
  MessagingProviderDriver,
  TicketProviderDriver,
  ToolContext,
} from '@webstackbuilders/plugin-ai-core-node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCollaborationTools } from '../registerTools';

const ctx: ToolContext = {
  logger: mockServices.logger.mock(),
  identity: 'user:default/tester',
  runId: 'run-1',
  signal: new AbortController().signal,
};

const createTicketDriver = (): TicketProviderDriver => ({
  providerId: 'test-tickets',
  searchTickets: vi.fn().mockResolvedValue([]),
  getTicket: vi.fn().mockResolvedValue({ id: 'T-1', title: 'x', state: 'open' }),
  createTicket: vi.fn().mockResolvedValue({ id: 'T-2', title: 'y', state: 'open' }),
  commentTicket: vi.fn().mockResolvedValue({ author: { id: 'bot' }, body: 'c' }),
});

const createMessagingDriver = (): MessagingProviderDriver => ({
  providerId: 'test-messaging',
  lookupChannel: vi.fn().mockResolvedValue({ id: 'C1', name: 'ops' }),
  postMessage: vi.fn().mockResolvedValue({ messageId: 'M1' }),
  getChannelHistory: vi.fn().mockResolvedValue([]),
});

describe('createCollaborationTools', () => {
  let ticketDriver: TicketProviderDriver;
  let messagingDriver: MessagingProviderDriver;

  const getTool = (id: string) => {
    const tool = createCollaborationTools({
      ticketDriver,
      messagingDriver,
      logger: mockServices.logger.mock(),
    }).find(candidate => candidate.id === id);

    if (!tool) throw new Error(`Tool '${id}' was not registered`);
    return tool;
  };

  beforeEach(() => {
    ticketDriver = createTicketDriver();
    messagingDriver = createMessagingDriver();
  });

  it('delegates ticket search to the ticket driver', async () => {
    await getTool('collaboration.ticket.search').invoke(
      { text: 'outage', limit: 5 },
      ctx,
    );

    expect(ticketDriver.searchTickets).toHaveBeenCalledWith({
      text: 'outage',
      limit: 5,
    });
  });

  it('delegates ticket lookup to the ticket driver', async () => {
    await getTool('collaboration.ticket.get').invoke({ ticketId: 'OPS-1' }, ctx);

    expect(ticketDriver.getTicket).toHaveBeenCalledWith('OPS-1');
  });

  it('delegates channel history to the messaging driver', async () => {
    await getTool('collaboration.channel.history').invoke({ channelId: 'C1' }, ctx);

    expect(messagingDriver.getChannelHistory).toHaveBeenCalledWith({
      channelId: 'C1',
    });
  });

  it('delegates message posting to the messaging driver', async () => {
    await getTool('collaboration.message.post').invoke(
      { channelId: 'C1', text: 'summary' },
      ctx,
    );

    expect(messagingDriver.postMessage).toHaveBeenCalledWith({
      channelId: 'C1',
      text: 'summary',
    });
  });

  it('rejects write calls that omit required arguments', async () => {
    await expect(
      getTool('collaboration.ticket.create').invoke({}, ctx),
    ).rejects.toThrow(/'title'/);
    await expect(
      getTool('collaboration.ticket.comment').invoke({ ticketId: 'OPS-1' }, ctx),
    ).rejects.toThrow(/'comment'/);
    await expect(
      getTool('collaboration.message.post').invoke({ channelId: 'C1' }, ctx),
    ).rejects.toThrow(/'text'/);
  });

  it('marks read and write effects correctly', () => {
    expect(getTool('collaboration.ticket.search').effect).toBe('read');
    expect(getTool('collaboration.channel.lookup').effect).toBe('read');
    expect(getTool('collaboration.ticket.create').effect).toBe('write');
    expect(getTool('collaboration.message.post').effect).toBe('write');
  });
});

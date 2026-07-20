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
import { LoggerService } from '@backstage/backend-plugin-api';
import { ToolDefinition } from '@webstackbuilders/plugin-ai-core-node';
import { CollaborationDriver } from '../providers';

type SearchTicketsArgs = { query: string };
type GetTicketArgs = { ticketId: string };
type LookupChannelArgs = { teamOrService: string };
type CreateTicketArgs = { title: string; description?: string; team?: string };
type CommentTicketArgs = { ticketId: string; comment: string };
type PostMessageArgs = { channelId: string; message: string };

/**
 * Creates the stable collaboration tool definitions backed by the supplied
 * ticketing and messaging drivers.
 */
export const createCollaborationTools = (opts: {
  ticketingDriver: CollaborationDriver;
  messagingDriver: CollaborationDriver;
  logger: LoggerService;
}): ToolDefinition[] => {
  const { ticketingDriver, messagingDriver, logger } = opts;

  return [
    {
      id: 'collaboration.ticket.search',
      description: 'Search tickets by query, service, team, or incident reference',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as SearchTicketsArgs;
        logger.debug('collaboration.ticket.search invoked', { query: payload.query });
        return ticketingDriver.searchTickets(payload.query);
      },
    },
    {
      id: 'collaboration.ticket.get',
      description: 'Fetch ticket details and linked discussions',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as GetTicketArgs;
        logger.debug('collaboration.ticket.get invoked', { ticketId: payload.ticketId });
        return ticketingDriver.getTicket(payload.ticketId);
      },
    },
    {
      id: 'collaboration.channel.lookup',
      description: 'Resolve a team or service to a messaging channel',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as LookupChannelArgs;
        logger.debug('collaboration.channel.lookup invoked', { teamOrService: payload.teamOrService });
        return messagingDriver.lookupChannel(payload.teamOrService);
      },
    },
    {
      id: 'collaboration.ticket.create',
      description: 'Create a ticket from an agent artifact',
      effect: 'write',
      async invoke(args: unknown) {
        const payload = args as CreateTicketArgs;
        logger.debug('collaboration.ticket.create invoked', { title: payload.title });
        return ticketingDriver.createTicket(payload);
      },
    },
    {
      id: 'collaboration.ticket.comment',
      description: 'Add a comment with trace/run links to a ticket',
      effect: 'write',
      async invoke(args: unknown) {
        const payload = args as CommentTicketArgs;
        logger.debug('collaboration.ticket.comment invoked', { ticketId: payload.ticketId });
        return ticketingDriver.commentTicket(payload.ticketId, payload.comment);
      },
    },
    {
      id: 'collaboration.message.post',
      description: 'Post a summary message to a messaging channel',
      effect: 'write',
      async invoke(args: unknown) {
        const payload = args as PostMessageArgs;
        logger.debug('collaboration.message.post invoked', { channelId: payload.channelId });
        return messagingDriver.postMessage(payload.channelId, payload.message);
      },
    },
  ];
};

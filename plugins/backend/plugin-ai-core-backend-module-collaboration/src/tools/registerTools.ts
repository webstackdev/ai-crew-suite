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
import {
  CreateTicketInput,
  MessagingHistoryQuery,
  MessagingProviderDriver,
  PostMessageInput,
  TicketProviderDriver,
  TicketSearchQuery,
  ToolDefinition,
} from '@webstackbuilders/plugin-ai-core-node';

export interface CreateCollaborationToolsOptions {
  ticketDriver: TicketProviderDriver;
  messagingDriver: MessagingProviderDriver;
  logger: LoggerService;
}

/**
 * Creates the stable collaboration tool definitions backed by the resolved
 * ticket and messaging drivers.
 */
export const createCollaborationTools = (
  options: CreateCollaborationToolsOptions,
): ToolDefinition[] => {
  const { ticketDriver, messagingDriver, logger } = options;

  return [
    {
      id: 'collaboration.ticket.search',
      description:
        'Searches tickets by free text, team, assignee, state, or label across the configured ticket management service.',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = (args ?? {}) as TicketSearchQuery;
        logger.debug('collaboration.ticket.search invoked', {
          text: payload.text,
          team: payload.team,
        });

        return ticketDriver.searchTickets(payload);
      },
    },
    {
      id: 'collaboration.ticket.get',
      description:
        'Fetches a single ticket with its description, comment thread, and assignee history.',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as { ticketId: string };
        logger.debug('collaboration.ticket.get invoked', {
          ticketId: payload?.ticketId,
        });

        if (!payload?.ticketId) {
          throw new Error("Missing required argument: 'ticketId'");
        }

        return ticketDriver.getTicket(payload.ticketId);
      },
    },
    {
      id: 'collaboration.ticket.create',
      description:
        'Opens a ticket from an agent artifact, optionally linked to a parent epic or story.',
      effect: 'write',
      async invoke(args: unknown) {
        const payload = args as CreateTicketInput;
        logger.debug('collaboration.ticket.create invoked', {
          title: payload?.title,
        });

        if (!payload?.title) {
          throw new Error("Missing required argument: 'title'");
        }

        return ticketDriver.createTicket(payload);
      },
    },
    {
      id: 'collaboration.ticket.comment',
      description:
        'Appends a comment carrying trace or run links to an existing ticket.',
      effect: 'write',
      async invoke(args: unknown) {
        const payload = args as { ticketId: string; comment: string };
        logger.debug('collaboration.ticket.comment invoked', {
          ticketId: payload?.ticketId,
        });

        if (!payload?.ticketId || !payload?.comment) {
          throw new Error(
            "Missing required arguments: 'ticketId' and 'comment'",
          );
        }

        return ticketDriver.commentTicket(payload.ticketId, payload.comment);
      },
    },
    {
      id: 'collaboration.channel.lookup',
      description:
        'Resolves a team or service name to a channel in the configured team communication service.',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as { teamOrService: string };
        logger.debug('collaboration.channel.lookup invoked', {
          teamOrService: payload?.teamOrService,
        });

        if (!payload?.teamOrService) {
          throw new Error("Missing required argument: 'teamOrService'");
        }

        return messagingDriver.lookupChannel(payload.teamOrService);
      },
    },
    {
      id: 'collaboration.channel.history',
      description:
        'Reads back a channel or thread transcript for incident context reconstruction.',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as MessagingHistoryQuery;
        logger.debug('collaboration.channel.history invoked', {
          channelId: payload?.channelId,
        });

        if (!payload?.channelId) {
          throw new Error("Missing required argument: 'channelId'");
        }

        return messagingDriver.getChannelHistory(payload);
      },
    },
    {
      id: 'collaboration.message.post',
      description:
        'Posts a summary or triage notification message to a channel or thread.',
      effect: 'write',
      async invoke(args: unknown) {
        const payload = args as PostMessageInput;
        logger.debug('collaboration.message.post invoked', {
          channelId: payload?.channelId,
        });

        if (!payload?.channelId || !payload?.text) {
          throw new Error("Missing required arguments: 'channelId' and 'text'");
        }

        return messagingDriver.postMessage(payload);
      },
    },
  ];
};

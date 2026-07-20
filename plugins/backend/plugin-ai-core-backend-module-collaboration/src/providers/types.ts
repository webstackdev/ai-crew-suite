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

/**
 * Normalized ticket record returned by collaboration drivers.
 */
export type TicketSummary = {
  /** Ticket identifier, such as a Jira key or Linear ID. */
  id: string;
  /** Ticket title or summary. */
  title: string;
  /** Ticket state, normalized to open/closed/done. */
  state: 'open' | 'closed' | 'done';
  /** Optional assignee identifier. */
  assignee?: string;
  /** Optional reporter or creator identifier. */
  reporter?: string;
  /** Optional ticket URL. */
  url?: string;
  /** Optional linked discussion or comment count. */
  commentCount?: number;
};

/**
 * Normalized ticket detail returned by collaboration drivers.
 */
export type TicketDetail = TicketSummary & {
  /** Optional ticket description text. */
  description?: string;
  /** Optional linked discussions or comments. */
  comments?: TicketComment[];
};

/**
 * Normalized ticket comment returned by collaboration drivers.
 */
export type TicketComment = {
  /** Comment author identifier. */
  author: string;
  /** Comment body text. */
  body: string;
  /** Optional ISO timestamp for when the comment was created. */
  createdAt?: string;
};

/**
 * Normalized messaging channel returned by collaboration drivers.
 */
export type ChannelSummary = {
  /** Channel identifier. */
  id: string;
  /** Channel display name. */
  name: string;
  /** Optional team or service the channel belongs to. */
  team?: string;
  /** Optional channel URL. */
  url?: string;
};

/**
 * Provider-neutral driver interface for collaboration operations.
 *
 * Implementations hide vendor-specific API calls (Jira, Linear, Slack, Teams)
 * behind this shared contract so agent tools depend on stable tool IDs rather
 * than provider SDKs.
 */
export interface CollaborationDriver {
  /** Unique provider identifier, such as `jira` or `slack`. */
  readonly providerId: string;
  /** Searches tickets by query, service, team, or incident reference. */
  searchTickets(query: string): Promise<TicketSummary[]>;
  /** Fetches ticket details and linked discussions. */
  getTicket(ticketId: string): Promise<TicketDetail>;
  /** Resolves a team or service to a messaging channel. */
  lookupChannel(teamOrService: string): Promise<ChannelSummary | undefined>;
  /** Creates a ticket from an agent artifact. */
  createTicket(input: {
    title: string;
    description?: string;
    team?: string;
  }): Promise<TicketSummary>;
  /** Adds a comment with trace/run links to a ticket. */
  commentTicket(ticketId: string, comment: string): Promise<TicketComment>;
  /** Posts a summary message to a messaging channel. */
  postMessage(channelId: string, message: string): Promise<{ messageId: string }>;
}

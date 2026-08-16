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
 * Collaboration module configuration. The core collaboration module reads these
 * identifiers to resolve the active drivers from the Maps managed by the ticket
 * and messaging extension points.
 */
export type CollaborationConfig = {
  /** Ticket driver identifier, such as `jira` or `linear`. */
  ticketing: string;
  /** Messaging driver identifier, such as `slack` or `teams`. */
  messaging: string;
};

/**
 * Normalized identity for a ticket reporter, assignee, or message author.
 */
export type CollaborationActor = {
  /** Stable provider-scoped identifier for the actor. */
  id: string;
  /** Human readable name when the provider exposes one. */
  displayName?: string;
  /** Email address when the provider exposes one. */
  email?: string;
};

/**
 * Provider-neutral lifecycle state for a ticket.
 */
export type TicketState = 'open' | 'in_progress' | 'blocked' | 'done' | 'closed';

/**
 * Normalized ticket comment.
 */
export type TicketComment = {
  /** Provider comment identifier when available. */
  id?: string;
  /** Comment author. */
  author: CollaborationActor;
  /** Plain text comment body. */
  body: string;
  /** ISO-8601 creation timestamp. */
  createdAt?: string;
};

/**
 * Record of an assignee transition, used by archeology-style agents that trace
 * ownership loops across a ticket's history.
 */
export type TicketAssigneeChange = {
  /** ISO-8601 timestamp of the transition. */
  changedAt: string;
  /** Previous assignee, absent when the ticket was unassigned. */
  from?: CollaborationActor;
  /** New assignee, absent when the ticket was unassigned. */
  to?: CollaborationActor;
};

/**
 * Normalized ticket record without comment or history expansion.
 */
export type TicketSummary = {
  /** Provider ticket identifier, such as a Jira key or Linear ID. */
  id: string;
  /** Ticket title or summary. */
  title: string;
  /** Normalized lifecycle state. */
  state: TicketState;
  /** Raw provider status name, preserved for prompts that need exact wording. */
  status?: string;
  /** Normalized priority label, such as `P1` or `High`. */
  priority?: string;
  /** Incident severity label when the provider tracks it separately. */
  severity?: string;
  /** Provider labels, tags, or components. */
  labels?: string[];
  /** Current assignee. */
  assignee?: CollaborationActor;
  /** Ticket reporter or creator. */
  reporter?: CollaborationActor;
  /** Owning team, project, or queue identifier. */
  team?: string;
  /**
   * Parent epic or story identifier. Release note agents traverse this to reach
   * customer-facing descriptions from an implementation ticket.
   */
  parentId?: string;
  /** Canonical ticket URL. */
  url?: string;
  /** ISO-8601 creation timestamp. */
  createdAt?: string;
  /** ISO-8601 last update timestamp. */
  updatedAt?: string;
};

/**
 * Normalized ticket record with discussion and ownership history expanded.
 */
export type TicketDetail = TicketSummary & {
  /** Ticket description body as plain text. */
  description?: string;
  /** Discussion thread attached to the ticket. */
  comments?: TicketComment[];
  /** Ordered assignee transitions, oldest first. */
  assigneeHistory?: TicketAssigneeChange[];
};

/**
 * Structured ticket search criteria. Drivers translate these fields into the
 * provider's own query language.
 */
export type TicketSearchQuery = {
  /** Free text matched against title and description. */
  text?: string;
  /** Restrict results to a team, project, or queue. */
  team?: string;
  /** Restrict results to a single assignee identifier. */
  assignee?: string;
  /** Restrict results to the given normalized states. */
  states?: TicketState[];
  /** Restrict results to tickets carrying all of the given labels. */
  labels?: string[];
  /** Maximum number of results. Drivers clamp this to their own page limits. */
  limit?: number;
};

/**
 * Fields accepted when an agent opens a ticket.
 */
export type CreateTicketInput = {
  /** Ticket title. */
  title: string;
  /** Ticket description body as plain text. */
  description?: string;
  /** Target team, project, or queue identifier. */
  team?: string;
  /** Labels, tags, or components to apply. */
  labels?: string[];
  /** Requested priority label. */
  priority?: string;
  /** Parent epic or story to link the new ticket under. */
  parentId?: string;
};

/**
 * Provider-neutral driver for ticket management services such as Jira, Linear,
 * Asana, GitHub Projects, or GitLab Issues.
 */
export interface TicketProviderDriver {
  /** Unique provider identifier, such as `jira`. */
  readonly providerId: string;
  /** Searches tickets using normalized criteria. */
  searchTickets(query: TicketSearchQuery): Promise<TicketSummary[]>;
  /** Fetches a ticket with its discussion and ownership history. */
  getTicket(ticketId: string): Promise<TicketDetail>;
  /** Opens a new ticket. */
  createTicket(input: CreateTicketInput): Promise<TicketSummary>;
  /** Appends a comment to an existing ticket. */
  commentTicket(ticketId: string, comment: string): Promise<TicketComment>;
}

/**
 * Normalized messaging channel.
 */
export type MessagingChannel = {
  /** Provider channel identifier. */
  id: string;
  /** Channel display name. */
  name: string;
  /** Owning team or service when the provider exposes one. */
  team?: string;
  /** Deep link to the channel. */
  url?: string;
};

/**
 * Normalized channel message.
 */
export type MessagingMessage = {
  /** Provider message identifier. */
  id: string;
  /** Channel the message belongs to. */
  channelId: string;
  /** Message author. */
  author: CollaborationActor;
  /** Plain text message body. */
  text: string;
  /** ISO-8601 creation timestamp. */
  createdAt?: string;
  /** Parent thread identifier when the message is a threaded reply. */
  threadId?: string;
  /** Deep link to the message. */
  url?: string;
};

/**
 * Fields accepted when an agent posts a message.
 */
export type PostMessageInput = {
  /** Target channel identifier. */
  channelId: string;
  /** Plain text message body. */
  text: string;
  /** Parent thread identifier when replying in a thread. */
  threadId?: string;
};

/**
 * Criteria for reading back channel or thread transcripts.
 */
export type MessagingHistoryQuery = {
  /** Channel to read from. */
  channelId: string;
  /** Restrict the read to a single thread. */
  threadId?: string;
  /** ISO-8601 lower bound on message timestamps. */
  since?: string;
  /** Maximum number of messages. Drivers clamp this to their own page limits. */
  limit?: number;
};

/**
 * Provider-neutral driver for team communication services such as Slack or
 * Microsoft Teams.
 */
export interface MessagingProviderDriver {
  /** Unique provider identifier, such as `slack`. */
  readonly providerId: string;
  /** Resolves a team or service name to a channel. */
  lookupChannel(teamOrService: string): Promise<MessagingChannel | undefined>;
  /** Posts a message to a channel or thread. */
  postMessage(input: PostMessageInput): Promise<{ messageId: string; url?: string }>;
  /** Reads back a channel or thread transcript. */
  getChannelHistory(query: MessagingHistoryQuery): Promise<MessagingMessage[]>;
}

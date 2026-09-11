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
import { ServiceActor } from '../common';

/**
 * ============================================================================
 *   CORE DYNAMIC PROJECT MANAGEMENT DRIVER INTERFACE
 * ============================================================================
 */

/**
 * Provider-neutral driver for transactional work tracking services such as
 * Jira, Linear, Asana, GitHub Projects, or GitLab Issues.
 *
 * This contract isolates concrete issue tracking API queries cleanly inside independent
 * backend module blocks, providing issue management systems for all 18 agentic plugins.
 */
export interface ProjectManagementDriver {
  /** Unique provider identifier, such as `jira` or `linear`. */
  readonly providerId: string;
  /** Searches tickets using normalized query constraint criteria. */
  searchTickets(query: TicketSearchQuery): Promise<TicketSummary[]>;
  /** Fetches an individual ticket with its complete discussion thread and historical ownership loops. */
  getTicket(ticketId: string): Promise<TicketDetail>;
  /** Opens a new task ticket under the target team or project board. */
  createTicket(input: CreateTicketInput): Promise<TicketSummary>;
  /** Appends a plain-text discussion comment to an existing ticket. */
  commentTicket(ticketId: string, comment: string): Promise<TicketComment>;
}

/**
 * ============================================================================
 *   TICKET STATE & CHRONOLOGICAL HISTORY DATA STRUCTURES (DTOs)
 * ============================================================================
 */

/** Provider-neutral lifecycle state for a work item tracking asset. */
export type TicketState = 'open' | 'in_progress' | 'blocked' | 'done' | 'closed';

/**
 * Normalized core ticket tracking context record.
 */
export type TicketSummary = {
  /** Provider ticket identifier, such as a Jira key or Linear ID string. */
  id: string;
  /** Ticket title or summary headline. */
  title: string;
  /** Normalized operational lifecycle state. */
  state: TicketState;
  /** Raw provider status name, preserved for prompts that need exact wording. */
  status?: string;
  /** Normalized priority label, such as `P1` or `High`. */
  priority?: string;
  /** Provider labels, tags, components, or category markers. */
  labels?: string[];
  /** Current active ticket assignee. */
  assignee?: ServiceActor;
  /** Ticket reporter or creator. */
  reporter?: ServiceActor;
  /** Owning team, project, or board identifier. */
  team?: string;
  /**
   * Parent epic or story identifier. Release note agents traverse this to reach
   * customer-facing descriptions from an implementation ticket.
   */
  parentId?: string;
  /** Canonical deep-link web browser URL heading back to the SaaS provider interface. */
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
  /** Ticket description body as plain text copy block. */
  description?: string;
  /** Discussion thread attached to the ticket. */
  comments?: TicketComment[];
  /** Ordered assignee transitions, oldest first. */
  assigneeHistory?: TicketAssigneeChange[];
};

/**
 * Normalized discussion thread comment.
 */
export type TicketComment = {
  /** Provider comment identifier when available. */
  id?: string;
  /** Comment author identity profile. */
  author: ServiceActor;
  /** Plain text comment body message content. */
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
  from?: ServiceActor;
  /** New assignee, absent when the ticket was unassigned. */
  to?: ServiceActor;
};

/**
 * ============================================================================
 *   DRIVER OPERATION QUERY CONSTRAINT PARAMS
 * ============================================================================
 */

/**
 * Structured ticket search criteria parameters. Drivers translate these fields into the
 * provider's own query language (e.g. JQL or GraphQL parameters).
 */
export type TicketSearchQuery = {
  /** Free text matched against title and description properties. */
  text?: string;
  /** Restrict results to a team, project, or board. */
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
  /** Ticket title summary headline. */
  title: string;
  /** Ticket description body as plain text copy block. */
  description?: string;
  /** Target team, project, or board identifier destination coordinate. */
  team?: string;
  /** Labels, tags, or components to apply upon creation. */
  labels?: string[];
  /** Requested priority tracking label. */
  priority?: string;
  /** Parent epic or story to link the new ticket under. */
  parentId?: string;
};

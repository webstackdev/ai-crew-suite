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
  ChannelSummary,
  CollaborationDriver,
  TicketComment,
  TicketDetail,
  TicketSummary,
} from './types';

/**
 * Configuration for the Jira collaboration driver.
 */
export type JiraDriverConfig = {
  /** Jira base URL, such as `https://my-org.atlassian.net`. */
  baseUrl?: string;
};

/**
 * Jira-backed collaboration driver.
 *
 * This first pass is a stub that returns empty results for read operations
 * and placeholder records for write operations. A real implementation will
 * wire the Jira REST API for ticket search, creation, and commenting.
 */
export class JiraDriver implements CollaborationDriver {
  readonly providerId = 'jira';
  private readonly logger: LoggerService;
  private readonly baseUrl: string;

  constructor(opts: { logger: LoggerService; config?: JiraDriverConfig }) {
    this.logger = opts.logger;
    this.baseUrl = opts.config?.baseUrl ?? '';
  }

  async searchTickets(_query: string): Promise<TicketSummary[]> {
    this.logger.debug('JiraDriver.searchTickets stub invoked');
    return [];
  }

  async getTicket(ticketId: string): Promise<TicketDetail> {
    this.logger.debug('JiraDriver.getTicket stub invoked', { ticketId });
    return {
      id: ticketId,
      title: '',
      state: 'open',
    };
  }

  async lookupChannel(
    _teamOrService: string,
  ): Promise<ChannelSummary | undefined> {
    // Channel lookup is handled by the messaging driver, not Jira.
    return undefined;
  }

  async createTicket(input: {
    title: string;
    description?: string;
    team?: string;
  }): Promise<TicketSummary> {
    this.logger.debug('JiraDriver.createTicket stub invoked', { title: input.title });
    return {
      id: 'CREATED-STUB',
      title: input.title,
      state: 'open',
      url: this.baseUrl ? `${this.baseUrl}/browse/CREATED-STUB` : undefined,
    };
  }

  async commentTicket(
    ticketId: string,
    comment: string,
  ): Promise<TicketComment> {
    this.logger.debug('JiraDriver.commentTicket stub invoked', { ticketId });
    return {
      author: 'ai-crew-suite',
      body: comment,
      createdAt: new Date().toISOString(),
    };
  }

  async postMessage(
    _channelId: string,
    _message: string,
  ): Promise<{ messageId: string }> {
    // Messaging is handled by the messaging driver, not Jira.
    throw new Error('JiraDriver does not support postMessage');
  }
}

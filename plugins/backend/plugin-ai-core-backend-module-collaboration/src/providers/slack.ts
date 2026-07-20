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
 * Configuration for the Slack collaboration driver.
 */
export type SlackDriverConfig = {
  /** Optional Slack workspace base URL. */
  baseUrl?: string;
};

/**
 * Slack-backed collaboration driver.
 *
 * This first pass is a stub focused on messaging operations. A real
 * implementation will wire the Slack Web API for channel lookup and posting.
 */
export class SlackDriver implements CollaborationDriver {
  readonly providerId = 'slack';
  private readonly logger: LoggerService;
  private readonly baseUrl: string;

  constructor(opts: { logger: LoggerService; config?: SlackDriverConfig }) {
    this.logger = opts.logger;
    this.baseUrl = opts.config?.baseUrl ?? '';
  }

  async searchTickets(_query: string): Promise<TicketSummary[]> {
    // Ticketing is handled by the ticketing driver, not Slack.
    return [];
  }

  async getTicket(_ticketId: string): Promise<TicketDetail> {
    throw new Error('SlackDriver does not support getTicket');
  }

  async lookupChannel(
    teamOrService: string,
  ): Promise<ChannelSummary | undefined> {
    this.logger.debug('SlackDriver.lookupChannel stub invoked', { teamOrService });
    return undefined;
  }

  async createTicket(_input: {
    title: string;
    description?: string;
    team?: string;
  }): Promise<TicketSummary> {
    throw new Error('SlackDriver does not support createTicket');
  }

  async commentTicket(_ticketId: string, _comment: string): Promise<TicketComment> {
    throw new Error('SlackDriver does not support commentTicket');
  }

  async postMessage(
    channelId: string,
    message: string,
  ): Promise<{ messageId: string }> {
    this.logger.debug('SlackDriver.postMessage stub invoked', { channelId });
    return { messageId: `stub-${Date.now()}` };
  }
}

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
import { ServiceActor } from './common';

/**
 * Normalized chat channel.
 */
export type CommunicationChannel = {
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
export type CommunicationMessage = {
  /** Provider message identifier. */
  id: string;
  /** Channel the message belongs to. */
  channelId: string;
  /** Message author. */
  author: ServiceActor;
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
export type MessageHistoryQuery = {
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
 * Provider-neutral driver for real-time human communication services such as
 * Slack or Microsoft Teams.
 */
export interface CommunicationDriver {
  /** Unique provider identifier, such as `slack`. */
  readonly providerId: string;
  /** Resolves a team or service name to a channel. */
  lookupChannel(teamOrService: string): Promise<CommunicationChannel | undefined>;
  /** Posts a message to a channel or thread. */
  postMessage(input: PostMessageInput): Promise<{ messageId: string; url?: string }>;
  /** Reads back a channel or thread transcript. */
  getChannelHistory(query: MessageHistoryQuery): Promise<CommunicationMessage[]>;
}

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
 * Persisted conversational message for session memory.
 */
export type SessionMessage = {
  /** Role that authored the message. */
  role: 'user' | 'assistant' | 'system';
  /** Message text content. */
  content: string;
  /** Optional token accounting associated with this message. */
  tokenUsage?: {
    /** Number of input tokens consumed. */
    input: number;
    /** Number of output tokens produced. */
    output: number;
    /** Total token count for the operation. */
    total: number;
  };
  /** Optional ISO timestamp for when the message was created. */
  createdAt?: string;
};

/**
 * Store for persisted agent conversation sessions.
 */
export interface SessionStore {
  /** Creates a new session for an agent and optional user, returning its ID. */
  createSession(agentId: string, userRef?: string): Promise<string>;
  /** Appends a message to an existing session. */
  appendMessage(sessionId: string, message: SessionMessage): Promise<void>;
  /** Lists recent messages for a session, optionally limited by count. */
  listMessages(sessionId: string, limit?: number): Promise<SessionMessage[]>;
}

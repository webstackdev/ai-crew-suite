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
 * Normalized identity for a person or bot in an external service, such as a
 * ticket assignee, message author, or on-call responder.
 */
export type ServiceActor = {
  /** Stable provider-scoped identifier for the actor. */
  id: string;
  /** Human readable name when the provider exposes one. */
  displayName?: string;
  /** Email address when the provider exposes one. */
  email?: string;
};

/**
 * Bounded time window used by history, metric, log, and trace queries.
 *
 * Integration drivers require a bounded window so an agent cannot accidentally
 * issue an unbounded query against a metered third-party API.
 */
export type TimeRange = {
  /** ISO-8601 inclusive lower bound. */
  since?: string;
  /** ISO-8601 exclusive upper bound. Defaults to now. */
  until?: string;
};

/**
 * Driver selector shared by every integration group module.
 *
 * Each core group module reads this from its own config namespace and resolves
 * the matching driver from the registry populated by its extension point.
 */
export type IntegrationProviderConfig = {
  /** Identifier of the registered driver to activate. */
  provider: string;
};

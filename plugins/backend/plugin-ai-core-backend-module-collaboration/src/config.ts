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
import { Config } from '@backstage/config';

/**
 * Supported ticketing provider identifiers.
 */
export type TicketingProviderId = 'jira' | 'linear';

/**
 * Supported messaging provider identifiers.
 */
export type MessagingProviderId = 'slack' | 'teams';

/**
 * Provider-specific connection configuration.
 */
export type ProviderConnectionConfig = {
  /** Optional base URL for the provider API. */
  baseUrl?: string;
};

/**
 * Collaboration module configuration read from `ai.integrations.collaboration`.
 */
export type CollaborationConfig = {
  /** Selected ticketing provider identifier. */
  ticketing: TicketingProviderId;
  /** Selected messaging provider identifier. */
  messaging: MessagingProviderId;
  /** Ticketing provider connection details keyed by provider id. */
  ticketingProviders: Partial<Record<TicketingProviderId, ProviderConnectionConfig>>;
  /** Messaging provider connection details keyed by provider id. */
  messagingProviders: Partial<Record<MessagingProviderId, ProviderConnectionConfig>>;
};

const TICKETING_PROVIDERS: readonly TicketingProviderId[] = ['jira', 'linear'];
const MESSAGING_PROVIDERS: readonly MessagingProviderId[] = ['slack', 'teams'];

const isTicketingProvider = (value: unknown): value is TicketingProviderId =>
  typeof value === 'string' &&
  (TICKETING_PROVIDERS as readonly string[]).includes(value);

const isMessagingProvider = (value: unknown): value is MessagingProviderId =>
  typeof value === 'string' &&
  (MESSAGING_PROVIDERS as readonly string[]).includes(value);

const readProviderConfigs = <T extends string>(
  config: Config,
  path: string,
  providers: readonly T[],
): Partial<Record<T, ProviderConnectionConfig>> => {
  const result: Partial<Record<T, ProviderConnectionConfig>> = {};
  const section = config.getOptionalConfig(path);
  if (!section) return result;
  for (const candidate of providers) {
    const providerConfig = section.getOptionalConfig(candidate);
    if (providerConfig) {
      result[candidate] = {
        baseUrl: providerConfig.getOptionalString('baseUrl'),
      };
    }
  }
  return result;
};

/**
 * Reads and validates collaboration module configuration from
 * `ai.integrations.collaboration`.
 */
export const readCollaborationConfig = (config: Config): CollaborationConfig => {
  const collabConfig = config.getOptionalConfig('ai.integrations.collaboration');

  if (!collabConfig) {
    throw new Error(
      'Collaboration module requires ai.integrations.collaboration configuration to be set',
    );
  }

  const ticketing = collabConfig.getOptionalString('ticketing');
  if (!ticketing) {
    throw new Error(
      'Collaboration module requires ai.integrations.collaboration.ticketing to be set',
    );
  }
  if (!isTicketingProvider(ticketing)) {
    throw new Error(
      `Collaboration module received unsupported ticketing provider '${ticketing}'. Supported: ${TICKETING_PROVIDERS.join(', ')}`,
    );
  }

  const messaging = collabConfig.getOptionalString('messaging');
  if (!messaging) {
    throw new Error(
      'Collaboration module requires ai.integrations.collaboration.messaging to be set',
    );
  }
  if (!isMessagingProvider(messaging)) {
    throw new Error(
      `Collaboration module received unsupported messaging provider '${messaging}'. Supported: ${MESSAGING_PROVIDERS.join(', ')}`,
    );
  }

  return {
    ticketing,
    messaging,
    ticketingProviders: readProviderConfigs(
      collabConfig,
      'ticketingProviders',
      TICKETING_PROVIDERS,
    ),
    messagingProviders: readProviderConfigs(
      collabConfig,
      'messagingProviders',
      MESSAGING_PROVIDERS,
    ),
  };
};

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
import { describe, expect, it } from 'vitest';
import { ConfigReader } from '@backstage/config';
import { readCollaborationConfig } from '../config';

describe('readCollaborationConfig', () => {
  it('reads a valid jira+slack config', () => {
    const config = new ConfigReader({
      ai: {
        integrations: {
          collaboration: {
            ticketing: 'jira',
            messaging: 'slack',
            ticketingProviders: { jira: { baseUrl: 'https://jira.example.com' } },
            messagingProviders: { slack: { baseUrl: 'https://slack.example.com' } },
          },
        },
      },
    });
    const result = readCollaborationConfig(config);
    expect(result.ticketing).toBe('jira');
    expect(result.messaging).toBe('slack');
    expect(result.ticketingProviders.jira?.baseUrl).toBe('https://jira.example.com');
    expect(result.messagingProviders.slack?.baseUrl).toBe('https://slack.example.com');
  });

  it('throws when collaboration config is missing', () => {
    const config = new ConfigReader({});
    expect(() => readCollaborationConfig(config)).toThrow(
      /ai\.integrations\.collaboration configuration to be set/,
    );
  });

  it('throws when ticketing provider is missing', () => {
    const config = new ConfigReader({
      ai: { integrations: { collaboration: { messaging: 'slack' } } },
    });
    expect(() => readCollaborationConfig(config)).toThrow(/ticketing to be set/);
  });

  it('throws when messaging provider is missing', () => {
    const config = new ConfigReader({
      ai: { integrations: { collaboration: { ticketing: 'jira' } } },
    });
    expect(() => readCollaborationConfig(config)).toThrow(/messaging to be set/);
  });

  it('throws when ticketing provider is unsupported', () => {
    const config = new ConfigReader({
      ai: { integrations: { collaboration: { ticketing: 'unsupported', messaging: 'slack' } } },
    });
    expect(() => readCollaborationConfig(config)).toThrow(/unsupported ticketing provider/);
  });

  it('throws when messaging provider is unsupported', () => {
    const config = new ConfigReader({
      ai: { integrations: { collaboration: { ticketing: 'jira', messaging: 'unsupported' } } },
    });
    expect(() => readCollaborationConfig(config)).toThrow(/unsupported messaging provider/);
  });
});

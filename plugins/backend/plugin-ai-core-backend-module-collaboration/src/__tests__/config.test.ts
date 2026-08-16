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
import { mockServices } from '@backstage/backend-test-utils';
import { describe, expect, it } from 'vitest';
import { readCollaborationConfig } from '../config';

const configOf = (data: object) => mockServices.rootConfig({ data });

describe('readCollaborationConfig', () => {
  it('reads the ticketing and messaging driver identifiers', () => {
    const config = configOf({
      ai: {
        integrations: {
          collaboration: { ticketing: 'jira', messaging: 'slack' },
        },
      },
    });

    expect(readCollaborationConfig(config)).toEqual({
      ticketing: 'jira',
      messaging: 'slack',
    });
  });

  it('throws when the collaboration section is missing', () => {
    expect(() => readCollaborationConfig(configOf({}))).toThrow(
      /requires ai.integrations.collaboration configuration/,
    );
  });

  it('throws when the ticketing identifier is missing', () => {
    const config = configOf({
      ai: { integrations: { collaboration: { messaging: 'slack' } } },
    });

    expect(() => readCollaborationConfig(config)).toThrow(
      /ai.integrations.collaboration.ticketing/,
    );
  });

  it('throws when the messaging identifier is missing', () => {
    const config = configOf({
      ai: { integrations: { collaboration: { ticketing: 'jira' } } },
    });

    expect(() => readCollaborationConfig(config)).toThrow(
      /ai.integrations.collaboration.messaging/,
    );
  });
});

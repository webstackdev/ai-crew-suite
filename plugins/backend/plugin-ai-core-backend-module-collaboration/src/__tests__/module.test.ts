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
import { createBackendModule, createBackendPlugin } from '@backstage/backend-plugin-api';
import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
import {
  ToolExtensionPoint,
  messagingDriversExtensionPoint,
  ticketDriversExtensionPoint,
  toolExtensionPoint,
} from '@webstackbuilders/plugin-ai-core-node';
import { describe, expect, it, vi } from 'vitest';
import { aiCoreBackendModuleCollaboration } from '../module';

const configData = {
  ai: {
    integrations: {
      collaboration: { ticketing: 'jira', messaging: 'slack' },
    },
  },
};

const createHostPlugin = (tools: { addTool: ReturnType<typeof vi.fn> }) =>
  createBackendPlugin({
    pluginId: 'ai-core',
    register(env) {
      env.registerExtensionPoint(toolExtensionPoint, tools as unknown as ToolExtensionPoint);
      env.registerInit({ deps: {}, async init() {} });
    },
  });

const createMockDriverModule = (moduleId: string, ticketing: string, messaging: string) =>
  createBackendModule({
    pluginId: 'ai-core',
    moduleId,
    register(env) {
      env.registerInit({
        deps: {
          ticketRegistry: ticketDriversExtensionPoint,
          messagingRegistry: messagingDriversExtensionPoint,
        },
        async init({ ticketRegistry, messagingRegistry }) {
          ticketRegistry.registerDriver({
            providerId: ticketing,
            searchTickets: vi.fn(),
            getTicket: vi.fn(),
            createTicket: vi.fn(),
            commentTicket: vi.fn(),
          });
          messagingRegistry.registerDriver({
            providerId: messaging,
            lookupChannel: vi.fn(),
            postMessage: vi.fn(),
            getChannelHistory: vi.fn(),
          });
        },
      });
    },
  });

describe('aiCoreBackendModuleCollaboration', () => {
  it('registers the collaboration tools once both drivers are registered', async () => {
    const tools = { addTool: vi.fn() };

    await startTestBackend({
      features: [
        createHostPlugin(tools),
        aiCoreBackendModuleCollaboration,
        createMockDriverModule('collaboration-mock', 'jira', 'slack'),
        mockServices.rootConfig.factory({ data: configData }),
        mockServices.logger.factory(),
      ],
    });

    expect(tools.addTool.mock.calls.map(([tool]) => tool.id)).toEqual([
      'collaboration.ticket.search',
      'collaboration.ticket.get',
      'collaboration.ticket.create',
      'collaboration.ticket.comment',
      'collaboration.channel.lookup',
      'collaboration.channel.history',
      'collaboration.message.post',
    ]);
  });

  it('fails when the configured ticket driver was never registered', async () => {
    await expect(
      startTestBackend({
        features: [
          createHostPlugin({ addTool: vi.fn() }),
          aiCoreBackendModuleCollaboration,
          createMockDriverModule('collaboration-mock', 'linear', 'slack'),
          mockServices.rootConfig.factory({ data: configData }),
          mockServices.logger.factory(),
        ],
      }),
    ).rejects.toThrow(/No ticket driver registered for identifier 'jira'/);
  });

  it('fails when the configured messaging driver was never registered', async () => {
    await expect(
      startTestBackend({
        features: [
          createHostPlugin({ addTool: vi.fn() }),
          aiCoreBackendModuleCollaboration,
          createMockDriverModule('collaboration-mock', 'jira', 'teams'),
          mockServices.rootConfig.factory({ data: configData }),
          mockServices.logger.factory(),
        ],
      }),
    ).rejects.toThrow(/No messaging driver registered for identifier 'slack'/);
  });
});

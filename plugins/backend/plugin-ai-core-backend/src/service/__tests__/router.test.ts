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
import http from 'node:http';
import { AddressInfo } from 'node:net';
import express, { type Request, type Response } from 'express';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type {
  AgentDefinition,
  SourceRegistry,
} from '@webstackbuilders/plugin-ai-core-node';
import type { AiBackendConfig } from '../../@types';
import { resolveConfiguredAgents } from '../factory';
import { bindRoutes, createRouter } from '../router';

const sourceRegistry: SourceRegistry = {
  register: jest.fn(),
  has: jest.fn((id: string) => id === 'catalog'),
  list: jest.fn(() => [{ id: 'catalog' }]),
};

const okHandler = (payload: unknown) =>
  jest.fn(async (_req: Request, res: Response) => res.status(200).json(payload));

const createController = () => ({
  createEmbeddings: okHandler({ ok: true }),
  deleteEmbeddings: okHandler({ ok: true }),
  getEmbeddings: okHandler({ ok: true }),
  listAgents: okHandler({ agents: [] }),
  startRun: okHandler({ ok: true }),
  streamRunEvents: okHandler({ ok: true }),
  approveRun: okHandler({ ok: true }),
  triggerRun: okHandler({ ok: true }),
  webhookRun: okHandler({ ok: true }),
});

const createLogger = () => {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(),
  };
  logger.child.mockReturnValue(logger);
  return logger;
};

const createConfig = () => ({
  getOptional: jest.fn(),
  getOptionalBoolean: jest.fn(),
  getOptionalConfig: jest.fn(),
  getOptionalString: jest.fn(),
  getOptionalStringArray: jest.fn(),
});

const createServer = async (router: express.Router) => {
  const app = express();
  app.use(express.json());
  app.use(router);

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));

  const address = server.address() as AddressInfo;
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
};

describe('router helpers', () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.map(
        server =>
          new Promise<void>((resolve, reject) => {
            server.close(error => {
              if (error) {
                reject(error);
                return;
              }
              resolve();
            });
          }),
      ),
    );
    servers.length = 0;
    jest.clearAllMocks();
  });

  it('adds config-defined agents without mutating the input map', () => {
    const existingAgent: AgentDefinition = {
      id: 'existing-agent',
      modelRef: 'model-a',
      systemPrompt: 'existing prompt',
      toolIds: ['catalog.read'],
      orchestrator: 'single-shot',
      memory: 'none',
    };
    const agents = new Map<string, AgentDefinition>([
      ['existing-agent', existingAgent],
    ]);
    const models = new Map<string, any>([['model-a', {}]]);
    const aiBackendConfig: AiBackendConfig = {
      defaults: {
        model: 'model-a',
        systemPrompt: 'default prompt',
      },
      agents: {
        'existing-agent': {
          model: 'model-b',
        },
        'configured-agent': {
          orchestrator: 'langgraph',
          tools: ['knowledge.retrieve'],
        },
      },
    };

    const resolved = resolveConfiguredAgents(agents, models, aiBackendConfig);

    expect(agents.size).toBe(1);
    expect(agents.get('configured-agent')).toBeUndefined();
    expect(resolved.size).toBe(2);
    expect(resolved.get('existing-agent')).toBe(existingAgent);
    expect(resolved.get('configured-agent')).toEqual({
      id: 'configured-agent',
      modelRef: 'model-a',
      systemPrompt: 'default prompt',
      toolIds: ['knowledge.retrieve'],
      orchestrator: 'langgraph',
      memory: 'session',
      crew: undefined,
    });
  });

  it('rejects unknown embedding sources before invoking the controller', async () => {
    const controller = createController();
    const router = bindRoutes(express.Router(), controller, sourceRegistry);
    const { server, baseUrl } = await createServer(router);
    servers.push(server);

    const response = await fetch(`${baseUrl}/embeddings/unknown?query=test`);
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.message).toContain('catalog');
    expect(controller.getEmbeddings).not.toHaveBeenCalled();
  });

  it('requires a non-empty embedding query and still exposes normal routes', async () => {
    const controller = createController();
    const router = bindRoutes(express.Router(), controller, sourceRegistry);
    const { server, baseUrl } = await createServer(router);
    servers.push(server);

    const invalidResponse = await fetch(`${baseUrl}/embeddings/catalog`);
    const invalidPayload = await invalidResponse.json();
    const blankResponse = await fetch(
      `${baseUrl}/embeddings/catalog?query=%20%20`,
    );
    const blankPayload = await blankResponse.json();
    const agentsResponse = await fetch(`${baseUrl}/agents`);
    const agentsPayload = await agentsResponse.json();

    expect(invalidResponse.status).toBe(422);
    expect(invalidPayload.message).toBe(
      'You should pass in the query via query params',
    );
    expect(blankResponse.status).toBe(422);
    expect(blankPayload.message).toBe(
      'You should pass in the query via query params',
    );
    expect(controller.getEmbeddings).not.toHaveBeenCalled();
    expect(agentsResponse.status).toBe(200);
    expect(agentsPayload).toEqual({ agents: [] });
    expect(controller.listAgents).toHaveBeenCalledTimes(1);
  });

  it('allows the all source umbrella value for embedding lookups', async () => {
    const controller = createController();
    const router = bindRoutes(express.Router(), controller, sourceRegistry);
    const { server, baseUrl } = await createServer(router);
    servers.push(server);

    const response = await fetch(`${baseUrl}/embeddings/all?query=test`);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    expect(controller.getEmbeddings).toHaveBeenCalledTimes(1);
  });

  it('routes rejected controller promises through the Backstage error middleware', async () => {
    const controller = createController();
    controller.listAgents = jest.fn(async () => {
      throw new Error('router failure');
    });

    const router = createRouter({
      logger: createLogger() as any,
      config: createConfig() as any,
      sourceRegistry,
      controller,
    });
    const { server, baseUrl } = await createServer(router);
    servers.push(server);

    const response = await fetch(`${baseUrl}/agents`);

    expect(response.status).toBe(500);
    expect(controller.listAgents).toHaveBeenCalledTimes(1);
  });
});

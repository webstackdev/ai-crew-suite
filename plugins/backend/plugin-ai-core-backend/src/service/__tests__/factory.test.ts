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
import { describe, expect, it, jest } from '@jest/globals';
import type {
  AgentDefinition,
  AugmentationIndexer,
  RetrievalPipeline,
  ToolDefinition,
} from '@webstackbuilders/plugin-ai-core-node';
import type { AiBackendConfig, AiBackendServiceOptions } from '../../@types';
import { createAiBackendServices, createSourceRegistry } from '../factory';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(),
});

const createConfig = (aiConfig?: AiBackendConfig) => ({
  getOptional: jest.fn((key: string) => (key === 'ai' ? aiConfig : undefined)),
  getOptionalConfig: jest.fn((key: string) => {
    if (key !== 'ai' || !aiConfig) {
      return undefined;
    }

    return {
      getOptionalStringArray(path: string) {
        if (path === 'supportedSources') {
          return aiConfig.supportedSources;
        }
        return undefined;
      },
    };
  }),
});

const createAugmentationIndexer = (): AugmentationIndexer => ({
  vectorStore: {} as AugmentationIndexer['vectorStore'],
  createEmbeddings: jest.fn(async () => 0),
  deleteEmbeddings: jest.fn(async () => undefined),
});

const createRetrievalPipeline = (): RetrievalPipeline => ({
  retrieveAugmentationContext: jest.fn(async () => []),
});

const createTool = (
  augmentationIndexer: AugmentationIndexer,
  retrievalPipeline: RetrievalPipeline,
): ToolDefinition => ({
  id: 'catalog.read',
  description: 'Catalog lookup tool',
  effect: 'read',
  augmentationIndexer,
  retrievalPipeline,
  invoke: jest.fn(async () => ({ ok: true })),
});

const createOptions = (
  overrides: Partial<AiBackendServiceOptions> = {},
): AiBackendServiceOptions => {
  const augmentationIndexer = createAugmentationIndexer();
  const retrievalPipeline = createRetrievalPipeline();

  return {
    logger: createLogger() as any,
    config: createConfig() as any,
    sourceRegistry: createSourceRegistry(),
    agents: new Map(),
    tools: new Map<string, ToolDefinition>([
      ['catalog.read', createTool(augmentationIndexer, retrievalPipeline)],
    ]),
    models: new Map<string, any>([['gpt-4o', {}]]),
    triggers: [],
    ...overrides,
  };
};

describe('createAiBackendServices', () => {
  it('builds resolved services without mutating source or agent registries', () => {
    const sourceRegistry = createSourceRegistry();
    sourceRegistry.register({ id: 'custom' });
    const agents = new Map<string, AgentDefinition>();
    const logger = createLogger();

    const services = createAiBackendServices({
      ...createOptions(),
      logger: logger as any,
      config: createConfig({ supportedSources: ['catalog'] }) as any,
      sourceRegistry,
      agents,
    });

    expect(sourceRegistry.has('catalog')).toBe(false);
    expect(services.sourceRegistry.has('catalog')).toBe(true);
    expect(agents.size).toBe(0);
    expect(services.agents.has('service-contextualizer')).toBe(true);
    expect(services.agents.has('doc-janitor-crew')).toBe(true);
    expect(services.defaultAgentId).toBe('service-contextualizer');
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        'AI backend services initialized: defaultAgent=service-contextualizer, agents=2, models=1',
      ),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('sources=2'),
    );
  });

  it('fails early when an agent references an unknown tool', () => {
    expect(() =>
      createAiBackendServices(
        createOptions({
          config: createConfig({
            agents: {
              reviewer: {
                tools: ['missing.tool'],
              },
            },
          }) as any,
        }),
      ),
    ).toThrow("Agent 'reviewer' references unknown tool 'missing.tool'");
  });

  it('fails early when runtime dependencies are missing', () => {
    expect(() =>
      createAiBackendServices(
        createOptions({
          tools: new Map([
            [
              'catalog.read',
              {
                id: 'catalog.read',
                description: 'Catalog lookup tool',
                effect: 'read',
                invoke: jest.fn(async () => ({ ok: true })),
              },
            ],
          ]),
        }),
      ),
    ).toThrow(
      'At least one augmentation indexer tool and one retrieval pipeline tool must be registered',
    );
  });

  it('fails early when the configured default model is not registered', () => {
    expect(() =>
      createAiBackendServices(
        createOptions({
          config: createConfig({ defaults: { model: 'missing-model' } }) as any,
        }),
      ),
    ).toThrow("Configured default model 'missing-model' is not registered");
  });

  it('fails early when the configured default agent is not registered', () => {
    expect(() =>
      createAiBackendServices(
        createOptions({
          config: createConfig({ defaults: { agent: 'missing-agent' } }) as any,
        }),
      ),
    ).toThrow("Configured default agent 'missing-agent' is not registered");
  });

  it('fails early when a crew agent has no roles', () => {
    expect(() =>
      createAiBackendServices(
        createOptions({
          agents: new Map<string, AgentDefinition>([
            [
              'empty-crew',
              {
                id: 'empty-crew',
                modelRef: 'gpt-4o',
                systemPrompt: '',
                toolIds: [],
                orchestrator: 'crew',
                memory: 'none',
                crew: { roles: [] },
              },
            ],
          ]),
        }),
      ),
    ).toThrow(
      "Agent 'empty-crew' is configured for crew orchestration but has no crew roles",
    );
  });

  it('fails early when a crew role references an unknown model', () => {
    expect(() =>
      createAiBackendServices(
        createOptions({
          config: createConfig({
            agents: {
              reviewer: {
                orchestrator: 'crew',
                crew: {
                  roles: [
                    {
                      id: 'reviewer',
                      systemPrompt: 'Review the output',
                      model: 'missing-model',
                    },
                  ],
                },
              },
            },
          }) as any,
        }),
      ),
    ).toThrow(
      "Crew role 'reviewer' on agent 'reviewer' references unknown model 'missing-model'",
    );
  });
});
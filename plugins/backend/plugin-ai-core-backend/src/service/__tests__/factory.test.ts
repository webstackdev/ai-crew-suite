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
import type { AiBackendConfig } from '../../@types';
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

describe('createAiBackendServices', () => {
  it('builds resolved services without mutating source or agent registries', () => {
    const sourceRegistry = createSourceRegistry();
    sourceRegistry.register({ id: 'custom' });

    const agents = new Map<string, AgentDefinition>();
    const augmentationIndexer = createAugmentationIndexer();
    const retrievalPipeline = createRetrievalPipeline();
    const tools = new Map<string, ToolDefinition>([
      ['catalog.read', createTool(augmentationIndexer, retrievalPipeline)],
    ]);
    const models = new Map<string, any>([['gpt-4o', {}]]);

    const services = createAiBackendServices({
      logger: createLogger() as any,
      config: createConfig({ supportedSources: ['catalog'] }) as any,
      sourceRegistry,
      agents,
      tools,
      models,
      triggers: [],
    });

    expect(sourceRegistry.has('catalog')).toBe(false);
    expect(services.sourceRegistry.has('catalog')).toBe(true);
    expect(agents.size).toBe(0);
    expect(services.agents.has('service-contextualizer')).toBe(true);
    expect(services.agents.has('doc-janitor-crew')).toBe(true);
    expect(services.defaultAgentId).toBe('service-contextualizer');
  });

  it('fails early when an agent references an unknown tool', () => {
    const augmentationIndexer = createAugmentationIndexer();
    const retrievalPipeline = createRetrievalPipeline();
    const tools = new Map<string, ToolDefinition>([
      ['catalog.read', createTool(augmentationIndexer, retrievalPipeline)],
    ]);
    const models = new Map<string, any>([['gpt-4o', {}]]);

    expect(() =>
      createAiBackendServices({
        logger: createLogger() as any,
        config: createConfig({
          agents: {
            reviewer: {
              tools: ['missing.tool'],
            },
          },
        }) as any,
        sourceRegistry: createSourceRegistry(),
        agents: new Map(),
        tools,
        models,
        triggers: [],
      }),
    ).toThrow("Agent 'reviewer' references unknown tool 'missing.tool'");
  });
});
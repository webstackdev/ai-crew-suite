/*
 * Copyright 2024 Larder Software Limited
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

import {
  createBackendPlugin,
  coreServices,
} from '@backstage/backend-plugin-api';
import { createPgAgentRuntimeStore } from '@webstackbuilders/plugin-ai-storage-pgvector-node';
import { BaseLLM } from '@langchain/core/language_models/llms';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  agentExtensionPoint,
  AgentDefinition,
  modelExtensionPoint,
  ModelDefinition,
  sourceExtensionPoint,
  SourceRegistry,
  toolExtensionPoint,
  ToolDefinition,
  triggerExtensionPoint,
  TriggerBinding,
} from '@webstackbuilders/plugin-ai-core-node';
import { createRouter } from './service/router';

const createSourceRegistry = (): SourceRegistry => {
  const sources = new Map<string, { id: string; description?: string }>();
  return {
    register(source) {
      sources.set(source.id, source);
    },
    list() {
      return [...sources.values()];
    },
    has(id) {
      return sources.has(id);
    },
  };
};

/**
 * Rag AI backend plugin
 *
 * @public
 */
export const ragAiPlugin = createBackendPlugin({
  pluginId: 'rag-ai',
  register(env) {
    const sourceRegistry = createSourceRegistry();
    const models = new Map<string, BaseLLM | BaseChatModel>();
    const tools = new Map<string, ToolDefinition>();
    const agents = new Map<string, AgentDefinition>();
    const triggers: TriggerBinding[] = [];

    env.registerExtensionPoint(sourceExtensionPoint, {
      addSource(source) {
        if (sourceRegistry.has(source.id)) {
          throw new Error(`Source '${source.id}' may only be registered once`);
        }
        sourceRegistry.register(source);
      },
    });

    env.registerExtensionPoint(toolExtensionPoint, {
      addTool(tool) {
        if (tools.has(tool.id)) {
          throw new Error(`Tool '${tool.id}' may only be registered once`);
        }
        tools.set(tool.id, tool);
      },
    });

    env.registerExtensionPoint(modelExtensionPoint, {
      addModel(modelDefinition: ModelDefinition) {
        if (models.has(modelDefinition.id)) {
          throw new Error(`Model '${modelDefinition.id}' may only be registered once`);
        }
        models.set(modelDefinition.id, modelDefinition.model);
      },
    });

    env.registerExtensionPoint(agentExtensionPoint, {
      addAgent(agent) {
        if (agents.has(agent.id)) {
          throw new Error(`Agent '${agent.id}' may only be registered once`);
        }
        agents.set(agent.id, agent);
      },
    });

    env.registerExtensionPoint(triggerExtensionPoint, {
      addTrigger(trigger) {
        triggers.push(trigger);
      },
    });

    env.registerInit({
      deps: {
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        httpRouter: coreServices.httpRouter,
        database: coreServices.database,
      },
      async init({ logger, config, httpRouter, database }) {
        const aiConfig = config.getOptionalConfig('ai');
        const configuredSources =
          aiConfig?.getOptionalStringArray('supportedSources') ??
          aiConfig?.getOptionalStringArray('sources') ??
          ['catalog'];

        configuredSources.forEach(sourceId => {
          if (!sourceRegistry.has(sourceId)) {
            sourceRegistry.register({ id: sourceId });
          }
        });

        const augmentationIndexer = [...tools.values()]
          .map(tool => tool.augmentationIndexer)
          .find(Boolean);
        const retrievalPipeline = [...tools.values()]
          .map(tool => tool.retrievalPipeline)
          .find(Boolean);

        if (!augmentationIndexer || !retrievalPipeline) {
          throw new Error(
            'At least one augmentation indexer tool and one retrieval pipeline tool must be registered',
          );
        }

        if (models.size === 0) {
          throw new Error('At least one model must be registered');
        }

        const defaultModelRef =
          aiConfig?.getOptionalString('defaults.model') ?? [...models.keys()][0];
        const defaultSystemPrompt =
          aiConfig?.getOptionalString('defaults.systemPrompt') ?? '';
        const defaultToolIds = [...tools.keys()];

        if (!agents.has('service-contextualizer')) {
          agents.set('service-contextualizer', {
            id: 'service-contextualizer',
            modelRef: defaultModelRef,
            systemPrompt: defaultSystemPrompt,
            toolIds: defaultToolIds,
            orchestrator: 'single-shot',
            memory: 'none',
          });
        }

        const defaultAgentId =
          aiConfig?.getOptionalString('defaults.agent') ?? 'service-contextualizer';

        if (!agents.has(defaultAgentId)) {
          throw new Error(`Configured default agent '${defaultAgentId}' is not registered`);
        }

        if (!models.has(defaultModelRef)) {
          throw new Error(`Configured default model '${defaultModelRef}' is not registered`);
        }

        logger.debug(`Registered ${triggers.length} AI triggers`);

        const runtimeStore = await createPgAgentRuntimeStore({
          logger,
          database,
        });

        httpRouter.use(
          await createRouter({
            logger,
            config,
            sourceRegistry,
            agents,
            tools,
            models,
            defaultAgentId,
            augmentationIndexer,
            retrievalPipeline,
            sessionStore: runtimeStore,
            checkpointStore: runtimeStore,
          }),
        );
      },
    });
  },
});

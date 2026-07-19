/*
 * Copyright 2024 Larder Software Limited
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

import {
  createBackendPlugin,
  coreServices,
} from '@backstage/backend-plugin-api';
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
import { createPgAgentRuntimeStore } from '@webstackbuilders/plugin-ai-core-backend-module-pgvector';
import { createAiBackendServices, createRouter, createSourceRegistry } from './service';

/**
 * Registers and boots the AI backend runtime.
 *
 * The plugin composes sources, tools, models, agents, triggers, and runtime
 * state stores, then exposes the HTTP/SSE API surface through the router.
 *
 * @public
 */
export const ragAiPlugin = createBackendPlugin({
  pluginId: 'ai-core',
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
        logger.debug(`Registered ${triggers.length} AI triggers`);

        const runtimeStore = await createPgAgentRuntimeStore({
          logger,
          database,
        });
        const services = createAiBackendServices({
          logger,
          config,
          sourceRegistry,
          agents,
          tools,
          models,
          sessionStore: runtimeStore,
          checkpointStore: runtimeStore,
          runStore: runtimeStore,
          artifactSink: runtimeStore,
          auditLogSink: runtimeStore,
          triggers,
        });

        httpRouter.use(
          createRouter({
            logger,
            config,
            sourceRegistry: services.sourceRegistry,
            controller: services.controller,
          }),
        );
      },
    });
  },
});

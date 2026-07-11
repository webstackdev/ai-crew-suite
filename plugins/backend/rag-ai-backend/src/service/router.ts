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
import express, { NextFunction, Request, Response } from 'express';
import Router from 'express-promise-router';
import { BaseLLM } from '@langchain/core/language_models/llms';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { isEmpty } from 'lodash';
import { MiddlewareFactory } from '@backstage/backend-defaults/rootHttpRouter';
import { RootConfigService } from '@backstage/backend-plugin-api';
import { LoggerService } from '@backstage/backend-plugin-api';
import {
  AgentDefinition,
  AugmentationIndexer,
  CheckpointStore,
  EntityFilterShape,
  Orchestrator,
  RetrievalPipeline,
  SessionStore,
  ToolDefinition,
  SourceRegistry,
} from '@webstackbuilders/plugin-ai-core-node';
import { LlmService } from './LlmService';
import { RagAiController } from './RagAiController';
import { AgentRuntime } from './AgentRuntime';
import { LangGraphOrchestrator } from './LangGraphOrchestrator';
import { SingleShotOrchestrator } from './SingleShotOrchestrator';
import { InMemoryToolRegistry } from './ToolRegistry';

type AiBackendConfig = {
  defaults?: {
    model?: string;
    systemPrompt?: string;
  };
  agents?: Record<
    string,
    {
      model?: string;
      systemPrompt?: string;
      orchestrator?: 'single-shot' | 'langgraph' | 'crew';
      tools?: string[];
      memory?: 'none' | 'session';
    }
  >;
  prompts?: {
    prefix: string;
    suffix: string;
  };
  supportedSources?: string[];
};

export interface RouterOptions {
  logger: LoggerService;
  sourceRegistry: SourceRegistry;
  agents: Map<string, AgentDefinition>;
  tools: Map<string, ToolDefinition>;
  models: Map<string, BaseLLM | BaseChatModel>;
  defaultAgentId: string;
  augmentationIndexer: AugmentationIndexer;
  retrievalPipeline: RetrievalPipeline;
  sessionStore?: SessionStore;
  checkpointStore?: CheckpointStore;
  config: RootConfigService;
}

const sourceValidator = (
  sourceRegistry: SourceRegistry,
) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const source = req.params.source;
  if (!sourceRegistry.has(source) && source !== 'all') {
    return res.status(422).json({
      message: `Only ${sourceRegistry
        .list()
        .map(it => it.id)
        .join(
        ', ',
      )} are supported as AI assistant query sources for now.`,
    });
  }
  return next();
};

const queryQueryValidator = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const query = req.query.query;
  if (!query || typeof query !== 'string' || isEmpty(query)) {
    return res.status(422).json({
      message: 'You should pass in the query via query params',
    });
  }
  return next();
};

const bodyQueryValidator = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const query = req.body.query;
  if (!query || typeof query !== 'string' || isEmpty(query)) {
    return res.status(422).json({
      message: 'You should pass in the query via request body',
    });
  }
  return next();
};

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const {
    logger,
    sourceRegistry,
    agents,
    tools,
    models,
    defaultAgentId,
    augmentationIndexer,
    retrievalPipeline,
    sessionStore,
    checkpointStore,
    config,
  } = options;
  const aiBackendConfig = config.getOptional<AiBackendConfig>('ai');
  const configuredAgents = aiBackendConfig?.agents;
  const configuredDefaultModelRef = aiBackendConfig?.defaults?.model;
  const fallbackModelRef = configuredDefaultModelRef ?? [...models.keys()][0];

  if (configuredAgents) {
    for (const [id, agentConfig] of Object.entries(configuredAgents)) {
      const existing = agents.get(id);
      if (!existing) {
        agents.set(id, {
          id,
          modelRef: agentConfig.model ?? fallbackModelRef,
          systemPrompt:
            agentConfig.systemPrompt ?? aiBackendConfig?.defaults?.systemPrompt ?? '',
          toolIds: agentConfig.tools ?? [],
          orchestrator: agentConfig.orchestrator ?? 'single-shot',
          memory:
            agentConfig.memory ??
            (agentConfig.orchestrator === 'langgraph' ? 'session' : 'none'),
        });
      }
    }
  }

  const llmService = new LlmService({
    logger,
    configuredPrompts: aiBackendConfig?.prompts,
  });

  const toolRegistry = new InMemoryToolRegistry();
  toolRegistry.register({
    id: 'knowledge.retrieve',
    description: 'Retrieve augmentation context for a source and query',
    effect: 'read',
    async invoke(args: unknown) {
      const payload = args as {
        query: string;
        source: string;
        entityFilter?: EntityFilterShape;
      };
      return retrievalPipeline.retrieveAugmentationContext(
        payload.query,
        payload.source,
        payload.entityFilter,
      );
    },
  });

  for (const tool of tools.values()) {
    toolRegistry.register(tool);
  }

  const orchestrators = new Map<string, Orchestrator>();
  orchestrators.set('single-shot', new SingleShotOrchestrator(llmService));
  orchestrators.set('langgraph', new LangGraphOrchestrator(llmService));

  const runtime = new AgentRuntime(agents, orchestrators);

  const controller = new RagAiController(
    logger,
    runtime,
    toolRegistry,
    augmentationIndexer,
    models,
    agents,
    defaultAgentId,
    retrievalPipeline,
    sessionStore,
    checkpointStore,
  );

  const router = Router();
  router.use(express.json());

  const middleware = MiddlewareFactory.create({ config, logger });
  router.use(middleware.error());

  const sourceValidatorMiddleware = sourceValidator(sourceRegistry);

  router
    .route('/embeddings/:source')
    .post(sourceValidatorMiddleware, controller.createEmbeddings)
    .delete(sourceValidatorMiddleware, controller.deleteEmbeddings)
    .get(
      sourceValidatorMiddleware,
      queryQueryValidator,
      controller.getEmbeddings,
    );

  router
    .route('/query/:source')
    .post(sourceValidatorMiddleware, bodyQueryValidator, controller.query);

  return router;
}

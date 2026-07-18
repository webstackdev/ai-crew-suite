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
import type {
  AgentDefinition,
  EntityFilterShape,
  Orchestrator,
  SourceRegistry,
} from '@webstackbuilders/plugin-ai-core-node';
import {
  AgentRuntime,
  LlmService
} from '../runtime';
import {
  CrewOrchestrator,
  LangGraphOrchestrator,
  SingleShotOrchestrator,
} from '../orchestrators';
import {
  createDefaultToolPackTools,
  InMemoryToolRegistry
} from '../tools';
import { RagAiController } from './RagAiController';
import type {
  AiBackendConfig,
  AiBackendServiceOptions,
  AiBackendServices,
  HardeningOptions,
  ModelRegistry,
  ToolMap,
} from '../@types';

/**
 * Creates a mutable in-memory source registry used during backend assembly.
 */
export const createSourceRegistry = (): SourceRegistry => {
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
 * Returns a merged agent map without mutating the caller-provided registry.
 *
 * Runtime-registered agents remain authoritative. Config-defined agents are
 * added only when no existing agent with the same id is already registered.
 */
export function resolveConfiguredAgents(
  agents: Map<string, AgentDefinition>,
  models: ModelRegistry,
  aiBackendConfig?: AiBackendConfig,
): Map<string, AgentDefinition> {
  const resolvedAgents = new Map(agents);
  const configuredAgents = aiBackendConfig?.agents;

  if (!configuredAgents) {
    return resolvedAgents;
  }

  const fallbackModelRef = aiBackendConfig?.defaults?.model ?? [...models.keys()][0];
  const fallbackSystemPrompt = aiBackendConfig?.defaults?.systemPrompt ?? '';

  for (const [id, agentConfig] of Object.entries(configuredAgents)) {
    if (resolvedAgents.has(id)) {
      continue;
    }

    resolvedAgents.set(id, {
      id,
      modelRef: agentConfig.model ?? fallbackModelRef,
      systemPrompt: agentConfig.systemPrompt ?? fallbackSystemPrompt,
      toolIds: agentConfig.tools ?? [],
      orchestrator: agentConfig.orchestrator ?? 'single-shot',
      memory:
        agentConfig.memory ??
        (agentConfig.orchestrator === 'langgraph' ? 'session' : 'none'),
      crew: agentConfig.crew
        ? {
            roles: agentConfig.crew.roles.map(role => ({
              id: role.id,
              systemPrompt: role.systemPrompt,
              modelRef: role.model,
              toolIds: role.tools,
            })),
          }
        : undefined,
    });
  }

  return resolvedAgents;
}

function resolveSourceRegistry(
  sourceRegistry: SourceRegistry,
  config: AiBackendServiceOptions['config'],
  logger: AiBackendServiceOptions['logger'],
): SourceRegistry {
  const resolvedSourceRegistry = createSourceRegistry();

  for (const source of sourceRegistry.list()) {
    resolvedSourceRegistry.register(source);
  }

  const aiConfig = config.getOptionalConfig('ai');
  const configuredSources =
    aiConfig?.getOptionalStringArray('supportedSources') ?? ['catalog'];

  for (const sourceId of configuredSources) {
    if (!resolvedSourceRegistry.has(sourceId)) {
      resolvedSourceRegistry.register({ id: sourceId });
    }
  }

  return resolvedSourceRegistry;
}

function resolveRuntimeDependencies(tools: ToolMap) {
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

  return { augmentationIndexer, retrievalPipeline };
}

function resolveDefaultModelRef(
  models: ModelRegistry,
  aiBackendConfig?: AiBackendConfig,
): string {
  if (models.size === 0) {
    throw new Error('At least one model must be registered');
  }

  const defaultModelRef = aiBackendConfig?.defaults?.model ?? [...models.keys()][0];
  if (!models.has(defaultModelRef)) {
    throw new Error(`Configured default model '${defaultModelRef}' is not registered`);
  }

  return defaultModelRef;
}

function resolveBuiltInAgents(
  agents: Map<string, AgentDefinition>,
  tools: ToolMap,
  models: ModelRegistry,
  aiBackendConfig?: AiBackendConfig,
): Map<string, AgentDefinition> {
  const resolvedAgents = new Map(agents);
  const defaultModelRef = resolveDefaultModelRef(models, aiBackendConfig);
  const defaultSystemPrompt = aiBackendConfig?.defaults?.systemPrompt ?? '';
  const defaultToolIds = [...tools.keys()];

  if (!resolvedAgents.has('service-contextualizer')) {
    resolvedAgents.set('service-contextualizer', {
      id: 'service-contextualizer',
      modelRef: defaultModelRef,
      systemPrompt: defaultSystemPrompt,
      toolIds: defaultToolIds,
      orchestrator: 'single-shot',
      memory: 'none',
    });
  }

  if (!resolvedAgents.has('doc-janitor-crew')) {
    const modelRefs = [...models.keys()];
    const reviewerModelRef = modelRefs[1] ?? defaultModelRef;
    resolvedAgents.set('doc-janitor-crew', {
      id: 'doc-janitor-crew',
      modelRef: defaultModelRef,
      systemPrompt:
        'Coordinate a multi-role documentation crew and produce a concise, high-quality artifact.',
      toolIds: [
        'knowledge.retrieve',
        'toolpack.github.search_issues',
        'toolpack.jira.search_tickets',
        'toolpack.cost.estimate',
      ],
      orchestrator: 'crew',
      memory: 'none',
      crew: {
        roles: [
          {
            id: 'researcher',
            systemPrompt:
              'Researcher: collect relevant context, constraints, and references.',
            modelRef: defaultModelRef,
            toolIds: ['knowledge.retrieve', 'toolpack.github.search_issues'],
          },
          {
            id: 'writer',
            systemPrompt:
              'Writer: draft the primary output in clear actionable language.',
            modelRef: defaultModelRef,
            toolIds: ['toolpack.jira.search_tickets'],
          },
          {
            id: 'reviewer',
            systemPrompt:
              'Reviewer: improve quality, consistency, and risk awareness.',
            modelRef: reviewerModelRef,
            toolIds: ['toolpack.cost.estimate'],
          },
        ],
      },
    });
  }

  return resolvedAgents;
}

function createToolRegistry(
  logger: AiBackendServiceOptions['logger'],
  retrievalPipeline: NonNullable<ReturnType<typeof resolveRuntimeDependencies>['retrievalPipeline']>,
  tools: ToolMap,
) {
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

  for (const tool of createDefaultToolPackTools(logger)) {
    if (!toolRegistry.get(tool.id)) {
      toolRegistry.register(tool);
    }
  }

  return toolRegistry;
}

function createOrchestrators(
  llmService: LlmService,
  agents: Map<string, AgentDefinition>,
  models: ModelRegistry,
) {
  const orchestrators = new Map<string, Orchestrator>();
  orchestrators.set('single-shot', new SingleShotOrchestrator(llmService));
  orchestrators.set('langgraph', new LangGraphOrchestrator(llmService));
  orchestrators.set('crew', new CrewOrchestrator(llmService, agents, models));
  return orchestrators;
}

function toHardeningOptions(aiBackendConfig?: AiBackendConfig): HardeningOptions {
  return {
    timeoutMs: aiBackendConfig?.hardening?.timeoutMs,
    maxRetries: aiBackendConfig?.hardening?.maxRetries,
    retryBackoffMs: aiBackendConfig?.hardening?.retryBackoffMs,
    maxTotalTokens: aiBackendConfig?.hardening?.maxTotalTokens,
    rateLimitPerMinute: aiBackendConfig?.hardening?.rateLimitPerMinute,
  };
}

function resolveDefaultAgentId(
  agents: Map<string, AgentDefinition>,
  aiBackendConfig?: AiBackendConfig,
): string {
  const defaultAgentId = aiBackendConfig?.defaults?.agent ?? 'service-contextualizer';

  if (!agents.has(defaultAgentId)) {
    throw new Error(`Configured default agent '${defaultAgentId}' is not registered`);
  }

  return defaultAgentId;
}

function validateResolvedAgents(
  agents: Map<string, AgentDefinition>,
  models: ModelRegistry,
  toolRegistry: InMemoryToolRegistry,
) {
  const availableToolIds = new Set(toolRegistry.list().map(tool => tool.id));

  for (const agent of agents.values()) {
    if (!models.has(agent.modelRef)) {
      throw new Error(
        `Agent '${agent.id}' references unknown model '${agent.modelRef}'`,
      );
    }

    for (const toolId of agent.toolIds) {
      if (!availableToolIds.has(toolId)) {
        throw new Error(`Agent '${agent.id}' references unknown tool '${toolId}'`);
      }
    }

    if (agent.orchestrator === 'crew' && (!agent.crew || agent.crew.roles.length === 0)) {
      throw new Error(
        `Agent '${agent.id}' is configured for crew orchestration but has no crew roles`,
      );
    }

    for (const role of agent.crew?.roles ?? []) {
      if (role.modelRef && !models.has(role.modelRef)) {
        throw new Error(
          `Crew role '${role.id}' on agent '${agent.id}' references unknown model '${role.modelRef}'`,
        );
      }

      for (const toolId of role.toolIds ?? []) {
        if (!availableToolIds.has(toolId)) {
          throw new Error(
            `Crew role '${role.id}' on agent '${agent.id}' references unknown tool '${toolId}'`,
          );
        }
      }
    }
  }
}

/**
 * Builds the resolved AI backend service graph from raw registries and config.
 *
 * This is the main reusable composition seam for backend plugins that want to
 * share controller/runtime assembly without depending on express route setup.
 */
export function createAiBackendServices(
  options: AiBackendServiceOptions,
): AiBackendServices {
  const {
    logger,
    sourceRegistry,
    agents,
    tools,
    models,
    sessionStore,
    checkpointStore,
    runStore,
    artifactSink,
    auditLogSink,
    triggers,
    config,
  } = options;
  const aiBackendConfig = config.getOptional<AiBackendConfig>('ai');
  const resolvedSourceRegistry = resolveSourceRegistry(sourceRegistry, config, logger);
  const { augmentationIndexer, retrievalPipeline } = resolveRuntimeDependencies(tools);
  const resolvedAgents = resolveConfiguredAgents(
    resolveBuiltInAgents(agents, tools, models, aiBackendConfig),
    models,
    aiBackendConfig,
  );
  const defaultAgentId = resolveDefaultAgentId(resolvedAgents, aiBackendConfig);

  const llmService = new LlmService({
    logger,
    configuredPrompts: aiBackendConfig?.prompts,
  });
  const toolRegistry = createToolRegistry(logger, retrievalPipeline, tools);
  validateResolvedAgents(resolvedAgents, models, toolRegistry);

  const runtime = new AgentRuntime(
    resolvedAgents,
    createOrchestrators(llmService, resolvedAgents, models),
  );
  const controller = new RagAiController(
    logger,
    runtime,
    toolRegistry,
    augmentationIndexer,
    models,
    resolvedAgents,
    defaultAgentId,
    retrievalPipeline,
    sessionStore,
    checkpointStore,
    runStore,
    artifactSink,
    auditLogSink,
    triggers ?? [],
    toHardeningOptions(aiBackendConfig),
  );

  logger.info(
    `AI backend services initialized: defaultAgent=${defaultAgentId}, agents=${resolvedAgents.size}, models=${models.size}, tools=${toolRegistry.list().length}, sources=${resolvedSourceRegistry.list().length}`,
  );

  return {
    aiBackendConfig,
    sourceRegistry: resolvedSourceRegistry,
    agents: resolvedAgents,
    defaultAgentId,
    augmentationIndexer,
    retrievalPipeline,
    toolRegistry,
    runtime,
    controller,
  };
}
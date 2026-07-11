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
  AgentDefinition,
  ModelDefinition,
  SourceDescriptor,
  ToolDefinition,
  TriggerBinding,
} from './types';
import { createExtensionPoint } from '@backstage/backend-plugin-api';

export interface SourceExtensionPoint {
  addSource(source: SourceDescriptor): void;
}

export const sourceExtensionPoint = createExtensionPoint<SourceExtensionPoint>({
  id: 'plugin-ai.source',
});

export interface ToolExtensionPoint {
  addTool(tool: ToolDefinition): void;
}

export const toolExtensionPoint = createExtensionPoint<ToolExtensionPoint>({
  id: 'plugin-ai.tool',
});

export interface ModelExtensionPoint {
  addModel(model: ModelDefinition): void;
}

export const modelExtensionPoint = createExtensionPoint<ModelExtensionPoint>({
  id: 'plugin-ai.model',
});

export interface AgentExtensionPoint {
  addAgent(agent: AgentDefinition): void;
}

export const agentExtensionPoint = createExtensionPoint<AgentExtensionPoint>({
  id: 'plugin-ai.agent',
});

export interface TriggerExtensionPoint {
  addTrigger(trigger: TriggerBinding): void;
}

export const triggerExtensionPoint =
  createExtensionPoint<TriggerExtensionPoint>({
    id: 'plugin-ai.trigger',
  });

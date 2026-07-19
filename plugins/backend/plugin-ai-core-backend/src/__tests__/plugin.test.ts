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
import { describe, expect, it } from 'vitest';
import {
  agentExtensionPoint,
  AgentDefinition,
  sourceExtensionPoint,
  SourceDescriptor,
} from '@webstackbuilders/plugin-ai-core-node';
import { ragAiPlugin } from '../plugin';

const createAgent = (id: string): AgentDefinition => ({
  id,
  modelRef: 'model-a',
  systemPrompt: 'Use grounded context',
  toolIds: [],
});

const capturePluginRegistrations = () => {
  const [registration] = (ragAiPlugin as unknown as {
    getRegistrations(): {
      extensionPoints: { extensionPoint: unknown; factory(): unknown }[];
      init?: unknown;
    }[];
  }).getRegistrations();

  const extensionPoints = new Map(
    registration.extensionPoints.map(({ extensionPoint, factory }) => [
      extensionPoint,
      factory(),
    ]),
  );

  return { registration, extensionPoints };
};

describe('ragAiPlugin boot registration', () => {
  it('fails safely when two sub-plugins register conflicting vector sources', () => {
    const { registration, extensionPoints } = capturePluginRegistrations();
    const sources = extensionPoints.get(sourceExtensionPoint) as {
      addSource(source: SourceDescriptor): void;
    };

    sources.addSource({ id: 'catalog', description: 'Primary catalog vector source' });

    expect(() =>
      sources.addSource({ id: 'catalog', description: 'Conflicting catalog vector source' }),
    ).toThrow("Source 'catalog' may only be registered once");
    expect(registration.init).toBeDefined();
  });

  it('fails safely when two sub-plugins register duplicate agent profiles', () => {
    const { registration, extensionPoints } = capturePluginRegistrations();
    const agents = extensionPoints.get(agentExtensionPoint) as {
      addAgent(agent: AgentDefinition): void;
    };

    agents.addAgent(createAgent('service-contextualizer'));

    expect(() => agents.addAgent(createAgent('service-contextualizer'))).toThrow(
      "Agent 'service-contextualizer' may only be registered once",
    );
    expect(registration.init).toBeDefined();
  });
});

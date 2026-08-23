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
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const createRoot = vi.fn(() => 'app-root');
  const createApp = vi.fn(() => ({ createRoot }));
  return { createApp, createRoot };
});

vi.mock('@backstage/frontend-defaults', () => ({ createApp: mocks.createApp }));
vi.mock('@backstage/plugin-catalog/alpha', () => ({ default: 'catalog' }));
vi.mock('@backstage/plugin-notifications/alpha', () => ({
  default: 'notifications',
}));
vi.mock('@backstage/plugin-search/alpha', () => ({ default: 'search' }));
vi.mock('@webstackbuilders/plugin-ai-crew-suite/alpha', () => ({
  default: 'ai-crew',
}));
vi.mock(
  '@webstackbuilders/plugin-ai-agent-frontend-kubernetes-ai-responder/alpha',
  () => ({
    default: 'kubernetes-ai-responder',
  }),
);
vi.mock(
  '@webstackbuilders/plugin-ai-agent-frontend-catalog-ai-insights/alpha',
  () => ({
    default: 'catalog-ai-insights',
  }),
);
vi.mock(
  '@webstackbuilders/plugin-ai-agent-frontend-oncall-ai-handover-assistant/alpha',
  () => ({ default: 'oncall-handover-assistant' })
);
vi.mock(
  '@webstackbuilders/plugin-ai-agent-frontend-release-notes-ai-generator/alpha',
  () => ({ default: 'release-notes-ai-generator' })
);
vi.mock(
  '@webstackbuilders/plugin-ai-agent-frontend-rfc-adr-ai-reviewer/alpha',
  () => ({ default: 'rfc-adr-ai-reviewer' })
);
vi.mock(
  '@webstackbuilders/plugin-ai-agent-frontend-alert-ai-tuner/alpha',
  () => ({ default: 'alert-ai-tuner' })
);
vi.mock(
  '@webstackbuilders/plugin-ai-agent-frontend-scaffolder-ai-drift-detector/alpha',
  () => ({ default: 'scaffolder-ai-drift-detector' })
);
vi.mock(
  '@webstackbuilders/plugin-ai-agent-frontend-scaffolder-ai-guardrail-agent/alpha',
  () => ({ default: 'scaffolder-ai-guardrail-agent' })
);
vi.mock(
  '@webstackbuilders/plugin-ai-agent-frontend-scaffolder-ai-infra/alpha',
  () => ({ default: 'scaffolder-ai-infra' })
);
vi.mock(
  '@webstackbuilders/plugin-ai-agent-frontend-search-ai-archeology/alpha',
  () => ({ default: 'search-ai-archeology' })
);
vi.mock(
  '@webstackbuilders/plugin-ai-agent-frontend-tech-debt-ai-scout/alpha',
  () => ({ default: 'tech-debt-ai-scout' })
);
vi.mock(
  '@webstackbuilders/plugin-ai-agent-frontend-tech-radar-ai-manager/alpha',
  () => ({ default: 'tech-radar-ai-manager' })
);
vi.mock(
  '@webstackbuilders/plugin-ai-agent-frontend-techdocs-ai-janitor/alpha',
  () => ({ default: 'techdocs-ai-janitor' })
);
vi.mock(
  '@webstackbuilders/plugin-ai-agent-frontend-techdocs-ai-postmortem/alpha',
  () => ({ default: 'techdocs-ai-postmortem' })
);
vi.mock('./modules/nav', () => ({ navModule: 'navigation' }));

describe('App', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('creates the application root from the configured feature set', async () => {
    const { default: App } = await import('./App');

    expect(mocks.createApp).toHaveBeenCalledWith({
      features: [
        'catalog',
        'notifications',
        'search',
        'navigation',
        'ai-crew',
        'kubernetes-ai-responder',
        'oncall-handover-assistant',
        'release-notes-ai-generator',
        'catalog-ai-insights',
        'alert-ai-tuner',
        'scaffolder-ai-drift-detector',
        'scaffolder-ai-guardrail-agent',
        'scaffolder-ai-infra',
        'rfc-adr-ai-reviewer',
        'search-ai-archeology',
        'tech-debt-ai-scout',
        'tech-radar-ai-manager',
        'techdocs-ai-janitor',
        'techdocs-ai-postmortem',
      ],
    });
    expect(mocks.createRoot).toHaveBeenCalledWith();
    expect(App).toBe('app-root');
  });
});

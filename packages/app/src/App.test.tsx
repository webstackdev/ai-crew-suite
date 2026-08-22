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
vi.mock('@webstackbuilders/plugin-ai-agent-frontend-oncall-ai-handover-assistant/alpha', () => ({ default: 'oncall-handover-assistant' }));
vi.mock('@webstackbuilders/plugin-ai-agent-frontend-release-notes-ai-generator/alpha', () => ({ default: 'release-notes-ai-generator' }));
vi.mock('@webstackbuilders/plugin-ai-agent-frontend-rfc-adr-ai-reviewer/alpha', () => ({ default: 'rfc-adr-ai-reviewer' }));
vi.mock('@webstackbuilders/plugin-ai-agent-frontend-alert-ai-tuner/alpha', () => ({ default: 'alert-ai-tuner' }));
vi.mock('@webstackbuilders/plugin-ai-agent-frontend-scaffolder-ai-drift-detector/alpha', () => ({ default: 'scaffolder-ai-drift-detector' }));
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
        'rfc-adr-ai-reviewer',
      ],
    });
    expect(mocks.createRoot).toHaveBeenCalledWith();
    expect(App).toBe('app-root');
  });
});

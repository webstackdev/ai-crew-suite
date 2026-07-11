import { describe, expect, it, vi } from 'vitest';

const createAppMock = vi.fn(() => ({ createRoot: vi.fn() }));

vi.mock('@backstage/frontend-defaults', () => ({
  createApp: createAppMock,
}));

vi.mock('@backstage/plugin-catalog/alpha', () => ({
  default: { id: 'catalog-plugin' },
}));

vi.mock('./scaffolder/scaffolderModule', () => ({
  scaffolderCustomizations: { id: 'scaffolder-customizations' },
}));

vi.mock('./modules/nav', () => ({
  navModule: { id: 'nav-module' },
}));

describe('App', () => {
  it('wires the expected features into createApp', async () => {
    const { default: app } = await import('./App');

    expect(createAppMock).toHaveBeenCalledWith({
      features: [
        { id: 'catalog-plugin' },
        { id: 'nav-module' },
        { id: 'scaffolder-customizations' },
      ],
    });
    expect(app).toBeDefined();
  });
});

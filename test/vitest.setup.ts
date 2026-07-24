import { vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

// ----------------------------------------------------
// Jest Compatibility Polyfills (Required by Backstage Mock Services)
// ----------------------------------------------------
globalThis.jest = {
  fn: (...args: any[]) => vi.fn(...args),
  spyOn: (...args: any[]) => vi.spyOn(...(args as [any, any])),
} as any;

// ----------------------------------------------------
// 1. Environment Detection
// ----------------------------------------------------

const isBrowserEnv = typeof window !== 'undefined';

// ----------------------------------------------------
// 2. Global Frontend / JSDOM Mocks & Polyfills
// ----------------------------------------------------

if (isBrowserEnv) {
  // Polyfill for standard fetch if using an older node layer inside JSDOM
  if (!window.fetch) {
    // @ts-ignore
    import('whatwg-fetch');
  }

  // Mock HTMLCanvasElement.prototype.getContext (Required by many UI components)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    return {} as RenderingContext;
  });

  // Mock window.matchMedia (Commonly required by Material-UI / Backstage themes)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated but required by older UI packages
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock IntersectionObserver (Commonly used in Backstage catalog grids)
  class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
  }
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });
}

// ----------------------------------------------------
// 3. Shared Global Backstage Mocking Layer
// ----------------------------------------------------

// Mock global environment config values if your plugins leverage standard Backstage configApi
vi.mock('@backstage/config', () => ({
  ConfigReader: class {
    getString(key: string) { return `mocked-${key}`; }
    getOptionalString(key: string) { return `mocked-${key}`; }
    getBoolean() { return true; }
  },
}));

// ----------------------------------------------------
// 4. Global Lifecycle Hooks (Cleaners and Resetters)
// ----------------------------------------------------

beforeAll(() => {
  // Silence specific console errors or warnings that pollute your test outputs
  vi.spyOn(console, 'error').mockImplementation((message) => {
    if (message?.toString().includes('Warning: ReactDOM.render is deprecated')) return;
    console.warn(message);
  });
});

beforeEach(() => {
  // Reset all vitest spies and manual mock records between test runs
  vi.resetAllMocks();
});

afterEach(() => {
  // Clear any global side-effects left behind by your components
  if (isBrowserEnv) {
    document.body.innerHTML = '';
  }
});

afterAll(() => {
  // Restore all original code implementations safely
  vi.restoreAllMocks();
});

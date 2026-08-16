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
  // JSDOM exposes CSS.escape as an unbound Web IDL method, unlike browsers.
  Object.defineProperty(window.CSS, 'escape', {
    configurable: true,
    value: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&'),
  });

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
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {}, // Deprecated but required by older UI packages
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }),
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
// 3. Global Lifecycle Hooks (Cleaners and Resetters)
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

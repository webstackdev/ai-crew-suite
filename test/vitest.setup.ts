/**
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
import { vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

// ----------------------------------------------------
// TypeScript Type Declarations for globalThis Merging
// ----------------------------------------------------
declare global {
  var jest: {
    fn: (...args: any[]) => ReturnType<typeof vi.fn>;
    spyOn: (...args: any[]) => any;
  };
}

// ----------------------------------------------------
// Jest Compatibility Polyfills (Required by Backstage Mock Services)
// ----------------------------------------------------
globalThis.jest = {
  fn: (...args: any[]) => vi.fn(...args),
  spyOn: (...args: any[]) => vi.spyOn(...(args as [any, any])),
};

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
    return {} as any; // Using any bypasses deep Canvas rendering context requirements
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

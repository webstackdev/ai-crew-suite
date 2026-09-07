/*
 * Copyright 2026 The AI Crew Suite Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://apache.org
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

declare global {
  var jest: {
    fn: (...args: any[]) => ReturnType<typeof vi.fn>;
    spyOn: (...args: any[]) => any;
  };
}

globalThis.jest = {
  fn: (...args: any[]) => vi.fn(...args),
  spyOn: (...args: any[]) => vi.spyOn(...(args as [any, any])),
};

const isBrowserEnv = typeof window !== 'undefined';

if (isBrowserEnv) {
  Object.defineProperty(window.CSS, 'escape', {
    configurable: true,
    value: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&'),
  });

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    return {} as any;
  });

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }),
  });

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

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation((message) => {
    if (message?.toString().includes('Warning: ReactDOM.render is deprecated')) return;
    console.warn(message);
  });
});

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  if (isBrowserEnv) {
    document.body.innerHTML = '';
  }
});

afterAll(() => {
  vi.restoreAllMocks();
});

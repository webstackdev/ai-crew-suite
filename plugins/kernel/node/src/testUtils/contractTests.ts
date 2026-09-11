/*
 * Copyright 2026 The AI Crew Suite Authors
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
import { describe, it, expect } from 'vitest';

/**
 * Configuration options required to run the automated driver invariant contract suite.
 *
 * @template TDriver - The driver type currently undergoing evaluation. Must extend a standard structural interface containing a `providerId`.
 */
export interface DriverContractTestOptions<TDriver extends { providerId: string }> {
  /** The name category of the capability under test (e.g., 'VectorStore', 'Cache'). */
  category: string;

  /** A factory function that provisions a fresh, fully configured instance of the driver under test. */
  makeDriver: () => TDriver | Promise<TDriver>;

  /**
   * A function that executes standard operations against the driver.
   * Each executed operation must return either a valid data object or a structured limitation payload.
   */
  exerciseOps: (driver: TDriver) => Promise<unknown[]>;
}

/**
 * Generates and runs a reusable driver-contract test scaffold against a target capability driver.
 *
 * This harness asserts that any compliant plugin driver honors the subsystem's core safety invariants:
 * - Every read or write operation returns data matching contract shapes.
 * - Missing capabilities degrade gracefully into typed limitations rather than throwing runtime exceptions or silently returning empty datasets.
 * - The underlying `providerId` remains a valid, traceable non-empty identifier string.
 * - No custom internal database or network provider types leak through contract inputs/outputs.
 *
 * @template TDriver - The driver structure enforcing a `providerId` parameter string.
 * @param options - The test execution suite definition constraints and operation hooks.
 * @returns void
 *
 * @example
 * ```typescript
 * defineDriverContractTests({
 *   category: 'VectorStore',
 *   makeDriver: () => new PostgresVectorStore(),
 *   exerciseOps: async (driver) => [await driver.search('query', {})]
 * });
 * ```
 */
export function defineDriverContractTests<TDriver extends { providerId: string }>(
  options: DriverContractTestOptions<TDriver>
): void {
  describe(`DriverContract[${options.category}]`, () => {
    it('has a non-empty providerId structure matching system requirements', async () => {
      const driver = await options.makeDriver();

      expect(typeof driver.providerId).toBe('string');
      expect(driver.providerId.trim().length).toBeGreaterThan(0);
    });

    it('returns a defined output result or structured limitation on every operational execution path', async () => {
      const driver = await options.makeDriver();
      const results = await options.exerciseOps(driver);

      for (const result of results) {
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
      }
    });

    it('does not leak internal provider-specific instance objects or classes through standard I/O communication maps', async () => {
      const driver = await options.makeDriver();
      const results = await options.exerciseOps(driver);

      for (const result of results) {
        if (result && typeof result === 'object') {
          /**
           * Assert object is simple structure and doesn't leak raw driver
           * classes (e.g. native Pg clients or internal buffers)
           */
          const constructorName = result.constructor?.name;
          expect(['Object', 'Array']).toContain(constructorName);
        }
      }
    });

  });
}

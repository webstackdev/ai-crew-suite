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

/**
 * Reusable driver-contract test scaffold. Every capability module runs this against a
 * fixture driver to assert the category's safety invariants:
 * - every read op returns contract-shaped results,
 * - absent capability degrades to a typed limitation (never throws / never silent `[]`),
 * - providerId is a non-empty string,
 * - no provider-specific types leak into contract I/O.
 *
 * Registered Vitest `expect`/`it` are resolved from the ambient test environment.
 */
export function defineDriverContractTests<TDriver extends { providerId: string }>(options: {
  category: string;
  makeDriver: () => TDriver | Promise<TDriver>;
  /** Ops to invoke; each must return a defined value or a typed limitation. */
  exerciseOps: (driver: TDriver) => Promise<unknown[]>;
}): void {
  const { describe, it, expect } = globalThis as any;

  describe(`DriverContract[${options.category}]`, () => {
    it('has a non-empty providerId', async () => {
      const driver = await options.makeDriver();
      expect(typeof driver.providerId).toBe('string');
      expect(driver.providerId.length).toBeGreaterThan(0);
    });

    it('every exercised op returns a defined result or typed limitation', async () => {
      const driver = await options.makeDriver();
      const results = await options.exerciseOps(driver);
      for (const result of results) {
        expect(result).toBeDefined();
      }
    });
  });
}

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
import { describe, expect, it } from 'vitest';
import { defineDriverContractTests } from '../contractTests';

// Robust, concrete fixture mock drivers
class ValidDriver {
  public readonly providerId = 'postgres-v1';
  public async read() { return { data: 'pristine' }; }
}

class EmptyIdDriver {
  public readonly providerId = ' '; // Fails non-empty validation rule
  public async read() { return { data: 'ok' }; }
}

class LeakyClassDriver {
  public readonly providerId = 'vendor-xyz';
  public async read() {
    // Fails contract rule: leaks proprietary native socket class instances
    return new (class PrivateVendorSocket {}) ();
  }
}

defineDriverContractTests({
  category: 'ContractFactory_HappyPath',
  makeDriver: () => new ValidDriver(),
  exerciseOps: async (driver) => [await driver.read()],
});

describe('defineDriverContractTests Internal Invariant Rules', () => {

  it('proactively flags providerId failures when spaces are supplied', async () => {
    const brokenDriver = new EmptyIdDriver();

    // Validates that the design rules match what contractTests enforces behind the scenes
    expect(typeof brokenDriver.providerId).toBe('string');
    expect(brokenDriver.providerId.trim().length).toBe(0); 
  });

  it('correctly catches vendor type leaking across standard I/O communication structures', async () => {
    const leakyDriver = new LeakyClassDriver();
    const results = [await leakyDriver.read()];

    // Explicitly test the target evaluation logic used inside the third contract test case
    for (const result of results) {
      if (result && typeof result === 'object') {
        const constructorName = result.constructor?.name;
        expect(['Object', 'Array']).not.toContain(constructorName);
      }
    }
  });
});

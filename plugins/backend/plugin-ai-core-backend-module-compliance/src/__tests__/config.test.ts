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
import { describe, expect, it } from 'vitest';
import { ConfigReader } from '@backstage/config';
import { readComplianceConfig } from '../config';

describe('readComplianceConfig', () => {
  it('reads a valid opa config', () => {
    const config = new ConfigReader({
      ai: { integrations: { compliance: { policy: 'opa', opa: { baseUrl: 'http://localhost:8181' } } } },
    });
    const result = readComplianceConfig(config);
    expect(result.policy).toBe('opa');
    expect(result.opa?.baseUrl).toBe('http://localhost:8181');
  });

  it('throws when config is missing', () => {
    expect(() => readComplianceConfig(new ConfigReader({}))).toThrow(
      /ai\.integrations\.compliance configuration to be set/,
    );
  });

  it('throws when policy is missing', () => {
    const config = new ConfigReader({ ai: { integrations: { compliance: {} } } });
    expect(() => readComplianceConfig(config)).toThrow(/policy to be set/);
  });

  it('throws when policy is unsupported', () => {
    const config = new ConfigReader({
      ai: { integrations: { compliance: { policy: 'bad' } } },
    });
    expect(() => readComplianceConfig(config)).toThrow(/Unsupported policy provider/);
  });
});

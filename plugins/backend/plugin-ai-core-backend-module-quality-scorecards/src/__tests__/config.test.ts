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
import { readQualityScorecardsConfig } from '../config';

describe('readQualityScorecardsConfig', () => {
  it('reads a valid soundcheck config', () => {
    const config = new ConfigReader({
      ai: { integrations: { qualityScorecards: { provider: 'soundcheck', soundcheck: { baseUrl: 'https://sc.example.com' } } } },
    });
    const result = readQualityScorecardsConfig(config);
    expect(result.provider).toBe('soundcheck');
    expect(result.providers.soundcheck?.baseUrl).toBe('https://sc.example.com');
  });

  it('throws when config is missing', () => {
    expect(() => readQualityScorecardsConfig(new ConfigReader({}))).toThrow(
      /ai\.integrations\.qualityScorecards configuration to be set/,
    );
  });

  it('throws when provider is missing', () => {
    const config = new ConfigReader({ ai: { integrations: { qualityScorecards: {} } } });
    expect(() => readQualityScorecardsConfig(config)).toThrow(/provider to be set/);
  });

  it('throws when provider is unsupported', () => {
    const config = new ConfigReader({
      ai: { integrations: { qualityScorecards: { provider: 'bad' } } },
    });
    expect(() => readQualityScorecardsConfig(config)).toThrow(/Unsupported quality provider/);
  });
});

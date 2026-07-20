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
import { readVcsConfig } from '../config';

describe('readVcsConfig', () => {
  it('reads a valid github provider config', () => {
    const config = new ConfigReader({
      ai: {
        integrations: {
          vcs: {
            provider: 'github',
            github: { host: 'github.example.com' },
          },
        },
      },
    });
    const result = readVcsConfig(config);
    expect(result.provider).toBe('github');
    expect(result.providers.github?.host).toBe('github.example.com');
  });

  it('throws when ai.integrations.vcs is missing', () => {
    const config = new ConfigReader({});
    expect(() => readVcsConfig(config)).toThrow(
      /ai\.integrations\.vcs configuration to be set/,
    );
  });

  it('throws when provider is missing', () => {
    const config = new ConfigReader({
      ai: { integrations: { vcs: {} } },
    });
    expect(() => readVcsConfig(config)).toThrow(
      /ai\.integrations\.vcs\.provider to be set/,
    );
  });

  it('throws when provider is unsupported', () => {
    const config = new ConfigReader({
      ai: { integrations: { vcs: { provider: 'unsupported' } } },
    });
    expect(() => readVcsConfig(config)).toThrow(/unsupported provider/);
  });

  it('reads multiple provider configs', () => {
    const config = new ConfigReader({
      ai: {
        integrations: {
          vcs: {
            provider: 'github',
            github: { host: 'github.com' },
            gitlab: { host: 'gitlab.com' },
          },
        },
      },
    });
    const result = readVcsConfig(config);
    expect(result.provider).toBe('github');
    expect(result.providers.github?.host).toBe('github.com');
    expect(result.providers.gitlab?.host).toBe('gitlab.com');
  });
});

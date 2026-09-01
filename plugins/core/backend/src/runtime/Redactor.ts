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

import {
  createRedactor,
  DEFAULT_REDACTION_POLICY,
  RedactionPolicy,
} from '@webstackbuilders/plugin-ai-core-node';
import type { RootConfigService } from '@backstage/backend-plugin-api';

/**
 * Engine for the configurable redaction policy. Replaces the hardcoded
 * SENSITIVE_KEYS redactor from the old AgentRuntime. Operators may append
 * patterns via `ai.redaction.*` config but cannot weaken the built-in floor.
 */
export class Redactor {
  private readonly redact: (value: unknown) => unknown;

  constructor(config?: RootConfigService) {
    const overrides = config?.getOptional<{
      redaction?: { keyPatterns?: string[]; valuePatterns?: string[]; mode?: 'redact' | 'reject' };
    }>('ai')?.redaction;

    const policy: RedactionPolicy = {
      keyPatterns: [
        ...DEFAULT_REDACTION_POLICY.keyPatterns,
        ...(overrides?.keyPatterns ?? []).map(p => new RegExp(p, 'i')),
      ],
      valuePatterns: [
        ...DEFAULT_REDACTION_POLICY.valuePatterns,
        ...(overrides?.valuePatterns ?? []).map(p => new RegExp(p)),
      ],
      mode: overrides?.mode ?? DEFAULT_REDACTION_POLICY.mode,
    };
    this.redact = createRedactor(policy);
  }

  /** Redact sensitive keys/values in an arbitrary payload. */
  apply(value: unknown): unknown {
    return this.redact(value);
  }
}

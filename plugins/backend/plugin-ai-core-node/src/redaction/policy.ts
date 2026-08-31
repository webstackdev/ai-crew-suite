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
 * Configurable redaction policy. Replaces the hardcoded SENSITIVE_KEYS list.
 * Operators may append patterns via config but cannot weaken the built-in floor.
 */
export type RedactionPolicy = {
  keyPatterns: RegExp[];
  valuePatterns: RegExp[];
  mode: 'redact' | 'reject';
};

const DEFAULT_KEYS = ['authorization', 'token', 'apikey', 'api_key', 'secret', 'password', 'cookie'];

/** Secure floor: today's key list plus common credential-shape scans. */
export const DEFAULT_REDACTION_POLICY: RedactionPolicy = {
  keyPatterns: DEFAULT_KEYS.map(k => new RegExp(k, 'i)),
  valuePatterns: [
    /ghp_[A-Za-z0-9]+/,           // GitHub token
    /xox[baprs]-[A-Za-z0-9-]+/,   // Slack token
    /AKIA[0-9A-Z]{16}/,           // AWS access key
  ],
  mode: 'redact',
};

/**
 * Build a redaction function from a policy. Replaces the old fixed `redact()` over
 * SENSITIVE_KEYS. In 'redact' mode, matched content is replaced with a placeholder; in
 * 'reject' mode, an error is thrown (the caller surfaces it as a `state_validation` failure).
 */
export function createRedactor(policy: RedactionPolicy): (value: unknown) => unknown {
  const redactValue = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(redactValue);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([key, val]) => {
          const isSensitiveKey = policy.keyPatterns.some(p => p.test(key));
          if (isSensitiveKey) {
            if (policy.mode === 'reject') {
              throw new Error(`Redaction policy rejected sensitive key '${key}'`);
            }
            return [key, '[REDACTED]'];
          }
          return [key, redactValue(val)];
        }),
      );
    }
    if (typeof v === 'string') {
      const sensitiveValue = policy.valuePatterns.some(p => p.test(v));
      if (sensitiveValue) {
        if (policy.mode === 'reject') {
          throw new Error('Redaction policy rejected credential-shaped value');
        }
        return '[REDACTED]';
      }
    }
    return v;
  };
  return redactValue;
}

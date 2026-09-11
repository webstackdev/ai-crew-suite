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
import { createRedactor, DEFAULT_REDACTION_POLICY, RedactionPolicy } from '../policy';

describe('Redaction Policy Thorough Test Suite', () => {
  describe('Default Policy Behavior (Mode: redact)', () => {
    const redact = createRedactor(DEFAULT_REDACTION_POLICY);

    it('passes through safe primitives completely unchanged', () => {
      expect(redact('hello world')).toBe('hello world');
      expect(redact(42)).toBe(42);
      expect(redact(true)).toBe(true);
      expect(redact(null)).toBe(null);
      expect(redact(undefined)).toBe(undefined);
    });

    it('redacts sensitive object keys case-insensitively', () => {
      const input = {
        username: 'kevin',
        password: 'super-secret-password',
        authorization: 'Bearer token123',
        apiKey: 'xyz-999',
      };

      expect(redact(input)).toEqual({
        username: 'kevin',
        password: '[REDACTED]',
        authorization: '[REDACTED]',
        apiKey: '[REDACTED]',
      });
    });

    it('scrubs credential-shaped substrings out of larger text blocks globally', () => {
      const ghpToken = 'ghp_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890';
      const input = `Failed connection log containing clone target targetUrl: https://${ghpToken}@://github.com`;

      expect(redact(input)).toBe(
        'Failed connection log containing clone target targetUrl: https://[REDACTED]@://github.com'
      );
    });

    // ✨ NEW THOROUGH TEST: Multi-token concatenation
    it('scrubs multiple distinct credential signatures out of a single aggregated text block', () => {
      const input = 'Alert metrics: token=xoxb-123456-7890 and primary key is AKIA1234567890ABCDEF';
      expect(redact(input)).toBe('Alert metrics: token=[REDACTED] and primary key is [REDACTED]');
    });

    it('handles recursively deep nested structures and arrays gracefully', () => {
      const input = {
        items: [
          { name: 'safe-item', token: 'xoxb-1234' },
          { name: 'another-safe-item', metadata: { secret: 'hidden' } },
        ],
      };

      expect(redact(input)).toEqual({
        items: [
          { name: 'safe-item', token: '[REDACTED]' },
          { name: 'another-safe-item', metadata: { secret: '[REDACTED]' } },
        ],
      });
    });

    // ✨ NEW THOROUGH TEST: Native JS non-plain objects protection
    it('safely passes through native JS objects like Dates or RegExps without corrupting them', () => {
      const testDate = new Date('2026-03-31T00:00:00.000Z');
      const testRegex = /abc/i;

      expect(redact(testDate)).toBe(testDate);
      expect(redact(testRegex)).toBe(testRegex);
    });

    it('bypasses complex instantiated prototype classes to prevent internal logic corruption', () => {
      class MockCustomService {
        constructor(public secretToken: string) {}
        getSecret() { return this.secretToken; }
      }

      const activeServiceInstance = new MockCustomService('ghp_123456');
      expect(redact(activeServiceInstance)).toBe(activeServiceInstance);
    });
  });

  describe('Strict Enforcement Gating (Mode: reject)', () => {
    const rejectPolicy: RedactionPolicy = {
      ...DEFAULT_REDACTION_POLICY,
      mode: 'reject',
    };
    const checkCompliance = createRedactor(rejectPolicy);

    it('throws immediate validation errors when a sensitive key is found', () => {
      const input = { safeKey: 'ok', token: 'some-value' };

      expect(() => checkCompliance(input)).toThrow(
        "Redaction policy violation: Sensitive property key 'token' detected."
      );
    });

    it('throws immediate validation errors when a credential shape text token is found', () => {
      const input = { logs: 'Action failed using access token: xoxp-12345-6789' };

      expect(() => checkCompliance(input)).toThrow(
        'Redaction policy violation: Credential-shaped token detected inside data content.'
      );
    });

    it('does not throw when validating completely clean datasets', () => {
      const input = { user: 'developer', status: 'active', tags: ['platform', 'core'] };
      expect(checkCompliance(input)).toEqual(input);
    });
  });
});

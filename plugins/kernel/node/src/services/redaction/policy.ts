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

/**
 * Configuration contract governing how data classification layers flag or filter sensitive entries.
 */
export type RedactionPolicy = {
  /** Regular expressions evaluated against object property names. */
  keyPatterns: RegExp[];
  /** Regular expressions evaluated against textual values (e.g. log chunks, strings). */
  valuePatterns: RegExp[];
  /**
   * Gating behavior applied upon hit detection:
   * - `redact`: Synchronously replaces sensitive text with safety placeholders.
   * - `reject`: Aborts execution immediately by throwing a validation error.
   */
  mode: 'redact' | 'reject';
};

const DEFAULT_KEYS = ['authorization', 'token', 'apikey', 'api_key', 'secret', 'password', 'cookie'];

/**
 * Foundational security baseline tracking common credential shapes and standard authentication properties.
 */
export const DEFAULT_REDACTION_POLICY: RedactionPolicy = {
  keyPatterns: DEFAULT_KEYS.map(key => new RegExp(key, 'i')),
  valuePatterns: [
    /ghp_[A-Za-z0-9]+/g,           // GitHub Personal Access Tokens
    /xox[baprs]-[A-Za-z0-9-]+/g,   // Slack Bot/User OAuth Tokens
    /AKIA[0-9A-Z]{16}/g,           // AWS Access Key Identifiers
  ],
  mode: 'redact',
};

/**
 * Factory that constructs an isolated data-cleansing function from a specified policy.
 *
 * In `redact` mode, matched content is cleanly replaced with a uniform string placeholder.
 * In `reject` mode, the scanner aborts on the first hit, raising a state validation error.
 *
 * @throws {Error} If policy mode is set to 'reject' and a violation is discovered.
 */
export function createRedactor(policy: RedactionPolicy): (value: unknown) => unknown {
  const { keyPatterns, valuePatterns, mode } = policy;

  const handleViolation = (contextMessage: string): string => {
    if (mode === 'reject') {
      throw new Error(`Redaction policy violation: ${contextMessage}`);
    }
    return '[REDACTED]';
  };

  const redactValue = (node: unknown): unknown => {
    // 1. Primitive Fallthrough Gating
    if (node === null || node === undefined) {
      return node;
    }

    // 2. Linear Array Traversal
    if (Array.isArray(node)) {
      return node.map(redactValue);
    }

    // 3. Text Blob Scan and In-String Replacement
    if (typeof node === 'string') {
      let scrubbedText = node;

      for (const pattern of valuePatterns) {
        if (pattern.test(node)) {
          if (mode === 'reject') {
            handleViolation('Credential-shaped token detected inside data content.');
          }
          // Perform global replacement of the sensitive token within the string
          scrubbedText = scrubbedText.replace(pattern, '[REDACTED]');
        }
      }
      return scrubbedText;
    }

    // 4. Structural Object Scanner (Ensures we only scan plain structures to avoid breaking complex prototype classes)
    if (typeof node === 'object') {
      // Guard against standard native JS non-plain structures safely via constructor parsing
      if (node.constructor === Date || node.constructor === RegExp) {
        return node;
      }

      const prototype = Object.getPrototypeOf(node);
      if (prototype !== null && prototype !== Object.prototype) {
        return node; // Bypass native framework instances (e.g. AbortSignal, LoggerService)
      }

      const cleanObject: Record<string, unknown> = {};
      const entries = Object.entries(node as Record<string, unknown>);

      for (const [key, value] of entries) {
        const matchesKeyRule = keyPatterns.some(pattern => pattern.test(key));

        if (matchesKeyRule) {
          cleanObject[key] = handleViolation(`Sensitive property key '${key}' detected.`);
        } else {
          cleanObject[key] = redactValue(value);
        }
      }

      return cleanObject;
    }

    return node;
  };

  return redactValue;
}

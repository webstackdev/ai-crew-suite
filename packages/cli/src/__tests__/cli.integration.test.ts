/**
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
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const currentDir = path.dirname(__filename);

describe('AI Crew Toolbelt CLI Integration Suite', () => {
  // 💡 Point directly to the compiled production build file.
  // Turborepo guarantees this file is fully built and up-to-date before running tests.
  const binaryPath = path.resolve(currentDir, '../../dist/bin/crew.js');

  it('should cleanly output the custom magenta header on help flags', () => {
    // 💡 Execute via raw node array parameters with shell: false to avoid security warning wrappers
    const result = spawnSync('node', [binaryPath, '--help'], {
      encoding: 'utf8',
      shell: false
    });

    // Commander natively exits with a clean 0 when an explicit '--help' flag hits a compiled bundle path
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('AI CREW SUITE');
    expect(result.stdout).toContain('build');
  });

  it('should terminate with a non-zero exit code on unrecognized commands', () => {
    const result = spawnSync('node', [binaryPath, 'invalid-task-name'], {
      shell: false
    });
    expect(result.status).not.toBe(0);
  });
});

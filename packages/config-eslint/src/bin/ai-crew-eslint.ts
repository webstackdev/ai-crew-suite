#!/usr/bin/env node
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

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const ROLE_ALIASES = new Map([
  ['node', 'node-library'],
  ['web', 'web-library'],
]);

function printUsage() {
  console.error(
    'Usage: ai-crew-eslint --role <role> <eslint args...>\n' +
      'Example: ai-crew-eslint --role node-library src --max-warnings 0',
  );
}

function parseArgs(argv: string[]) {
  const forwardedArgs: string[] = [];
  let role: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--role') {
      role = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--role=')) {
      role = arg.slice('--role='.length);
      continue;
    }

    forwardedArgs.push(arg);
  }

  return {
    role: role ? ROLE_ALIASES.get(role) ?? role : undefined,
    forwardedArgs,
  };
}

function resolveEslintBinPath() {
  const eslintPackageJsonPath = require.resolve('eslint/package.json');
  const eslintPackageJson = JSON.parse(readFileSync(eslintPackageJsonPath, 'utf8')) as {
    bin: { eslint: string };
  };

  return path.resolve(path.dirname(eslintPackageJsonPath), eslintPackageJson.bin.eslint);
}

const { role, forwardedArgs } = parseArgs(process.argv.slice(2));

if (!role) {
  printUsage();
  process.exit(2);
}

const eslintBinPath = resolveEslintBinPath();
const configFilePath = fileURLToPath(
  new URL('../eslint.package-role.config.js', import.meta.url),
);

const result = spawnSync(
  process.execPath,
  [eslintBinPath, '--config', configFilePath, ...forwardedArgs],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      AI_CREW_SUITE_ESLINT_ROLE: role,
    },
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
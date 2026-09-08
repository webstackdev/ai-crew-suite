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

/**
 * A mapping of shorthand role names to their full role names.
 */
const ROLE_ALIASES = new Map<string, string>([
  ['node', 'node-library'],
  ['web', 'web-library'],
]);

/**
 * CLI usage syntax and an example to standard error.
 */
function printUsage(): void {
  console.error(
    'Usage: ai-crew-eslint --role  \n' +
    'Example: ai-crew-eslint --role node-library src --max-warnings 0',
  );
}

/**
 * T{he p}arsed CLI arguments.
 */
interface ParsedArgs {
  /** The fully resolved config role name, or undefined if none was supplied. */
  role: string | undefined;
  /** All arguments that should be passed through directly to ESLint. */
  forwardedArgs: string[];
}

/**
 * Parses the provided command-line arguments to extract the --role parameter
 * and isolate remaining flags.
 *
 * @param argv - An array of raw command-line argument strings.
 * @returns The extracted canonical role name and an array of remaining forwarded arguments.
 */
function parseArgs(argv: string[]): ParsedArgs {
  const forwardedArgs: string[] = [];
  let role: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    // Guard against out-of-bounds or undefined array indices
    if (arg === undefined) {
      continue;
    }

    if (arg === '--role') {
      const nextArg = argv[index + 1];

      if (nextArg !== undefined) {
        role = nextArg;
        index += 1;
      }

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

/**

* Resolves the absolute path to the main binary file exported by the eslint package.
*
* @returns The full system file path to the ESLint binary wrapper.
* @throws Error If the eslint package json file or its bin.eslint entry is missing.
*/
function resolveEslintBinPath(): string {
  const eslintPackageJsonPath = require.resolve('eslint/package.json');
  const eslintPackageJson = JSON.parse(readFileSync(eslintPackageJsonPath, 'utf8')) as {
    bin?: { eslint?: string };
  };

  const binPath = eslintPackageJson.bin?.eslint;
  if (!binPath) {
    throw new Error("Could not find a valid 'bin.eslint' entry in 'eslint/package.json'.");
  }

  return path.resolve(path.dirname(eslintPackageJsonPath), binPath);
}

// ============================================================================
// Execution Execution Entry Point
// ============================================================================

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

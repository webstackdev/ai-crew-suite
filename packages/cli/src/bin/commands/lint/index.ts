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
// 📂 packages/cli/src/bin/commands/lint/index.ts
import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import chalk from 'chalk';
import { getWorkspaceContext } from '../../utils/workspace.js';

const program = new Command();

program
  .name('lint')
  .description('Run structural ESLint static code validations across the workspace')
  .allowUnknownOption(true) // Native argument/flag forwarding protection
  .action(() => {
    const context = getWorkspaceContext();

    console.log(`${chalk.blue('🚨 Executing ESLint Analysis for:')} ${chalk.bold(context.packageName)} ${chalk.gray(`(${context.role})`)}`);

    // Capture standard flags (like --fix, --max-warnings 0) passed directly by users or CI
    const forwardedArgs = process.argv.slice(3);

    // Call standard eslint on the current package scope directory context cleanly.
    // ESLint will walk up to the root folder, read eslint.config.js, and lint process.cwd().
    const lintResult = spawnSync(
      'yarn',
      ['eslint', '.', ...forwardedArgs],
      {
        stdio: 'inherit',
        shell: true,
        cwd: context.packageDir,
      }
    );

    if (lintResult.error) {
      console.error(chalk.red('❌ Process Execution Error: Failed to invoke ESLint engine.'), lintResult.error);
      process.exit(1);
    }

    process.exit(lintResult.status ?? 0);
  });

program.parse(process.argv);

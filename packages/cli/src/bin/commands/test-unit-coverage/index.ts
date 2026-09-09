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
import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { getWorkspaceContext } from '../../utils/workspace.js';

const program = new Command();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

program
  .name('test:unit:coverage')
  .description('Execute package unit tests matrix and write coverage metric distribution files')
  .allowUnknownOption(true)
  .action(() => {
    const context = getWorkspaceContext();

    console.log(`${chalk.blue('📊 Executing Unit Tests with Coverage for:')} ${chalk.bold(context.packageName)}`);

    // 1. Point straight to the internal compiled configuration file inside your distribution folder
    const internalConfigPath = path.resolve(__dirname, '../test-unit/lib/vitest.config.js');

    const forwardedArgs = process.argv.slice(3);

    // 2. Dispatch Vitest explicitly passing the compiler coverage collection parameters
    const testResult = spawnSync(
      'yarn',
      ['vitest', 'run', '--coverage', '-c', internalConfigPath, ...forwardedArgs],
      {
        stdio: 'inherit',
        shell: true,
        cwd: context.packageDir,
      }
    );

    if (testResult.error) {
      console.error(chalk.red('❌ Process Execution Error: Failed to invoke Vitest coverage engine.'), testResult.error);
      process.exit(1);
    }

    process.exit(testResult.status ?? 0);
  });

program.parse(process.argv);

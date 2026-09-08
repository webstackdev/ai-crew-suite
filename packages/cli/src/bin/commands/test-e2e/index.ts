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
import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { getWorkspaceContext } from '../../utils/workspace.js';

const program = new Command();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

program
  .name('test:e2e')
  .description('Run end-to-end integration tests via Playwright')
  .allowUnknownOption(true)
  .action(() => {
    const context = getWorkspaceContext();

    console.log(`${chalk.magenta('🎭 AI CREW SUITE: Orchestrating Playwright E2E Runner matrix')}`);

    const internalConfigPath = path.resolve(__dirname, 'lib/playwright.config.js');
    const forwardedArgs = process.argv.slice(3);

    const result = spawnSync('yarn', ['playwright', 'test', '--config', internalConfigPath, ...forwardedArgs], {
      stdio: 'inherit',
      shell: true,
      cwd: context.repoRoot
    });

    if (result.error) {
      console.error(chalk.red('❌ Process Execution Error: Failed to invoke Playwright engine.'), result.error);
      process.exit(1);
    }

    process.exit(result.status ?? 0);
  });

program.parse(process.argv);

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
// 📂 packages/cli/src/bin/commands/storybook-build/index.ts
import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';

const program = new Command();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

program
  .name('storybook:build')
  .description('Compile a static distribution build of the workspace documentation stories')
  .allowUnknownOption(true)
  .action(() => {
    console.log(`${chalk.green('📦 AI CREW SUITE: Compiling static documentation artifact layers...')}`);

    const internalConfigDir = path.resolve(__dirname, '../storybook/config');
    const forwardedArgs = process.argv.slice(3);

    const result = spawnSync('yarn', ['storybook', 'build', '--config-dir', internalConfigDir, ...forwardedArgs], {
      stdio: 'inherit',
      shell: true,
      cwd: path.resolve(__dirname, '../../../../')
    });

    process.exit(result.status ?? 0);
  });

program.parse(process.argv);

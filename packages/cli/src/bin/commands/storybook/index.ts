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
import chalk from 'chalk';
import { getWorkspaceContext } from '../../utils/workspace.js';

const program = new Command();

program
  .name('storybook')
  .description('Boot up the localized interactive Storybook documentation server')
  .allowUnknownOption(true)
  .action(() => {
    const context = getWorkspaceContext();
    console.log(`${chalk.green('📖 AI CREW SUITE: Spinning up central Storybook environment workspace...')}`);

    const forwardedArgs = process.argv.slice(3);

    // Securely invoke the task specifically targetting the infra package via Turbo natively
    const result = spawnSync('yarn', ['turbo', 'run', 'storybook', '--filter=@ai-crew-suite/storybook-workspace-infra', ...forwardedArgs], {
      stdio: 'inherit',
      shell: true,
      cwd: context.repoRoot
    });

    process.exit(result.status ?? 0);
  });

program.parse(process.argv);

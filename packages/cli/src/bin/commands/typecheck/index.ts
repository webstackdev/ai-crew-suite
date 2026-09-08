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

const program = new Command();

program
  .description('Perform static TypeScript verification')
  .action(() => {
    console.log(`\x1b[34m⎋ Executing typecheck in:\x1b[0m ${process.cwd()}`);

    const result = spawnSync('npx', ['tsc', '--noEmit'], {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd()
    });

    process.exit(result.status ?? 0);
  });

program.parse(process.argv);

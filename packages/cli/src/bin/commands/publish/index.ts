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
import fs from 'node:fs';
import path from 'node:path';

const program = new Command();

program
  .description('Orchestrate workspace npm releases using Changesets')
  .allowUnknownOption(true) // Allows passing random downstream flags transparently
  .action(() => {
    const currentWorkingDir = process.cwd();

    // 1. Guardrail: Enforce running strictly from the Monorepo Root Workspace
    // Changesets expects to read the global root .changeset/ directory context
    const hasRootFiles = fs.existsSync(path.resolve(currentWorkingDir, 'turbo.json')) && 
                         fs.existsSync(path.resolve(currentWorkingDir, '.changeset'));

    if (!hasRootFiles) {
      console.error(
        `\n\x1b[31m❌ Release Policy Violation:\x1b[0m 'crew publish' must be executed from the monorepo root.\n` +
        `   Current directory: ${currentWorkingDir}\n`
      );
      process.exit(1);
    }

    // 2. Output custom deployment headers reflecting your new scope namespace
    console.log('\n\x1b[35m┌────────────────────────────────────────────────────────┐\x1b[0m');
    console.log(`\x1b[35m│ 🚀 AI CREW SUITE: Deploying Scope Targets (@ai-crew)   │\x1b[0m`);
    console.log('\x1b[35m└────────────────────────────────────────────────────────┘\x1b[0m\n');

    // 3. Extract trailing flags (e.g. any dynamic settings or override variables)
    const forwardedArgs = process.argv.slice(3);

    // 4. Hand off execution cleanly to Changesets
    const publishResult = spawnSync(
      'yarn',
      ['changeset', 'publish', ...forwardedArgs],
      {
        stdio: 'inherit',
        shell: true,
        cwd: currentWorkingDir,
        env: {
          ...process.env,
        }
      }
    );

    // 5. Bubble up the process execution exit code back to the GitHub Runner agent
    process.exit(publishResult.status ?? 0);
  });

program.parse(process.argv);

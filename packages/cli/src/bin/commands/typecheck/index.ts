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
import { createRequire } from 'node:module';
import path from 'node:path';
import chalk from 'chalk';

const program = new Command();
const require = createRequire(import.meta.url);

program
  .name('typecheck')
  .description('Perform static TypeScript verification across the package workspace')
  .allowUnknownOption(true) // Allows developers to forward flags like --watch natively
  .action(() => {
    // 1. Stylized layout message header block matching your brand aesthetic
    console.log(`${chalk.blue('⎋ Executing static typecheck analysis in:')} ${chalk.gray(process.cwd())}`);

    // Capture trailing args passed by the user (like --watch or --pretty)
    const forwardedArgs = process.argv.slice(3);

    const typescriptPackageJson = require.resolve('typescript/package.json');
    const typescriptCliPath = path.resolve(
      path.dirname(typescriptPackageJson),
      'bin/tsc',
    );

    // Run the repository's TypeScript compiler while preserving the target cwd.
    const result = spawnSync(
      process.execPath,
      [typescriptCliPath, '--noEmit', ...forwardedArgs],
      {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd(),
      },
    );

    // 3. Resilient Error Tracking Boundary Control
    if (result.error) {
      console.error(chalk.red(`❌ Process Execution Error: Failed to invoke typecheck engine.`), result.error);
      process.exit(1);
    }

    // Capture explicit compiler status codes or map unexpected signal terminations to failure states
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }

    console.log(`${chalk.green('✅ Typecheck verification passed successfully!')}\n`);
    process.exit(0);
  });

program.parse(process.argv);

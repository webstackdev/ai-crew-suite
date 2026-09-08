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
import fs from 'node:fs';
import path from 'node:path';

const program = new Command();

program
  .name('clean')
  .description('Wipe local build artifacts and distribution directories')
  .action(() => {
    const targetDir = path.resolve(process.cwd(), 'dist');
    console.log(`\x1b[34m🧹 Cleaning target workspace:\x1b[0m ${process.cwd()}`);

    try {
      if (fs.existsSync(targetDir)) {
        // Native equivalent of rimraf (recursive + force ignores missing folders)
        fs.rmSync(targetDir, { recursive: true, force: true });
        console.log(`\x1b[32m✅ Successfully removed:\x1b[0m ${targetDir}`);
      } else {
        console.log('\x1b[90m🛈\u2003 No local "dist" folder found. Skipping clean.\x1b[0m');
      }
    } catch (error) {
      console.error(`\x1b[31m❌ Failed to clear distribution directory:\x1b[0m`, error);
      process.exit(1);
    }
  });

program.parse(process.argv);

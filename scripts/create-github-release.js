#!/usr/bin/env node
/**
 * Copyright 2026 Webstack Builders, Inc.
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
const { execSync } = require('child_process');

const [TAG_NAME, BOOL_CREATE_RELEASE] = process.argv.slice(2);
const isDraft = !BOOL_CREATE_RELEASE;

async function main() {
  console.log(`Processing GitHub release orchestration for tag: ${TAG_NAME}`);

  try {
    const draftFlag = isDraft ? '--draft' : '';

    const command = `gh release create "${TAG_NAME}" \
      --title "${TAG_NAME}" \
      --generate-notes \
      ${draftFlag}`;

    console.log(`Executing orchestration wrapper command...`);
    const output = execSync(command, {
      encoding: 'utf8',
      env: {
        ...process.env,
        GH_TOKEN: process.env.GITHUB_TOKEN
      }
    });

    console.log(`Operation executed successfully!\n${output}`);
  } catch (error) {
    console.error('Failed to provision GitHub release framework layer:', error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    process.exit(1);
  }
}

main();

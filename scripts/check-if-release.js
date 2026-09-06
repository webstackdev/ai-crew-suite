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
const fs = require('fs');

try {
  // Leverage Changesets status tool to determine if any package changed versions
  const statusLog = execSync('yarn changeset status --output=json', { encoding: 'utf8' });
  const hasReleases = JSON.parse(statusLog).releases?.length > 0;

  fs.appendFileSync(process.env.GITHUB_OUTPUT, `needs_release=${hasReleases}\n`);
  console.log(`Version bumps detected: ${hasReleases}`);
} catch {
  // Fallback: If changeset status is empty or errors, check if a changeset file exists
  const hasChangesets = fs.readdirSync('.changeset').some(file => file.endsWith('.md') && file !== 'README.md');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `needs_release=${hasChangesets}\n`);
  console.log(`Changesets detected: ${hasChangesets}`);
}

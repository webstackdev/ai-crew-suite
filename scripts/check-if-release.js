#!/usr/bin/env node

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

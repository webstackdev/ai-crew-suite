#!/usr/bin/env node

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

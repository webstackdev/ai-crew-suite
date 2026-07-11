#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

async function main() {
  const { GITHUB_SHA, GITHUB_TOKEN } = process.env;
  if (!GITHUB_SHA || !GITHUB_TOKEN) {
    throw new Error('Critical telemetry vectors (GITHUB_SHA or GITHUB_TOKEN) are missing.');
  }

  // Extract the target repository owner and name directly from the GitHub runner environment
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  console.log(`Target repository detected: ${owner}/${repo}`);

  // Generate an automated date-based tracking label matching your distribution history
  const date = new Date();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const baseTagName = `release-${yyyy}-${mm}-${dd}`;

  // Fetch all current repository tags using the native GitHub CLI tool to check for overlaps
  let tagName = baseTagName;
  let index = 0;
  
  try {
    const existingTagsLog = execSync('gh tag list --limit 100', {
      encoding: 'utf8',
      env: { ...process.env, GH_TOKEN: GITHUB_TOKEN }
    });
    
    const existingTagNames = existingTagsLog.split('\n').map(t => t.trim().split('\t')[0]);

    while (existingTagNames.includes(tagName)) {
      index += 1;
      tagName = `${baseTagName}.${index}`;
    }
  } catch (e) {
    console.log('No matching tags extracted or repository is uninitialized. Proceeding with baseline tag configuration.');
  }

  console.log(`Provisioning structural production release tag: ${tagName}`);

  // Push the newly verified reference marker up to the master repository tree
  execSync(`git tag -a "${tagName}" -m "${tagName}" ${GITHUB_SHA}`);
  execSync(`git push origin "${tagName}"`, {
    env: { ...process.env, GITHUB_TOKEN }
  });

  // Safely stream the output parameters into the updated GitHub tracking context layer
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `tag_name=${tagName}\n`);
    console.log(`Variable linked cleanly to GITHUB_OUTPUT context pipeline: ${tagName}`);
  }
}

main().catch(error => {
  console.error(error.stack);
  process.exit(1);
});

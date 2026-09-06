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
 *
 * Synchronizes TypeScript project references for all packages in the monorepo
 * to ensure that each package's tsconfig.json correctly references its
 * internal dependencies.
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * 1. Find all leaf packages in the monorepo that have a package.json
 */
function findPackages(dir, packageMaps = new Map()) {
  if (!fs.existsSync(dir)) return packageMaps;
  const files = fs.readdirSync(dir);

  if (files.includes('package.json')) {
    try {
      const pkgJson = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      if (pkgJson.name) {
        packageMaps.set(pkgJson.name, {
          name: pkgJson.name,
          dirPath: dir,
          relativeFromRoot: path.relative(ROOT_DIR, dir).replace(/\\/g, '/'),
          pkgJson
        });
      }
    } catch (e) {
      console.error(`Failed parsing package.json in ${dir}`);
    }
    return packageMaps;
  }

  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory() && !file.startsWith('.') && file !== 'node_modules' && file !== 'dist') {
      findPackages(fullPath, packageMaps);
    }
  }
  return packageMaps;
}

// Gather all workspace packages
const allPackages = new Map();
findPackages(path.join(ROOT_DIR, 'apps'), allPackages);
findPackages(path.join(ROOT_DIR, 'plugins'), allPackages);

console.log(`Analyzing internal dependency graphs for ${allPackages.size} packages...`);

/**
 * 2. Update tsconfig.json for each package based on its internal dependencies
 */
allPackages.forEach((pkgInfo) => {
  const tsconfigPath = path.join(pkgInfo.dirPath, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) return; // Skip if no tsconfig exists

  // Gather all declared dependencies
  const deps = {
    ...pkgInfo.pkgJson.dependencies,
    ...pkgInfo.pkgJson.devDependencies,
    ...pkgInfo.pkgJson.peerDependencies
  };

  const tsconfigReferences = [];

  // Look for internal workspace dependencies (@ai-crew-suite/*)
  Object.keys(deps).forEach((depName) => {
    if (allPackages.has(depName)) {
      const targetPkg = allPackages.get(depName);

      // Calculate relative path from THIS package to the TARGET package
      let relativePath = path.relative(pkgInfo.dirPath, targetPkg.dirPath).replace(/\\/g, '/');

      // Node path.relative doesn't add leading './' for siblings, ensure valid tsconfig path format
      if (!relativePath.startsWith('.')) {
        relativePath = `./${relativePath}`;
      }

      tsconfigReferences.push({ path: relativePath });
    }
  });

  // Sort alphabetically to maintain layout consistency
  tsconfigReferences.sort((a, b) => a.path.localeCompare(b.path));

  try {
    const tsconfigRaw = fs.readFileSync(tsconfigPath, 'utf8');
    // Strip comments safely for perfect JSON handling
    const cleanJsonString = tsconfigRaw.replace(/\/\/.*$/gm, '');
    const tsconfigData = JSON.parse(cleanJsonString);

    // Only write changes if references actually need updating
    const existingRefsStr = JSON.stringify(tsconfigData.references || []);
    const newRefsStr = JSON.stringify(tsconfigReferences);

    if (existingRefsStr !== newRefsStr) {
      tsconfigData.references = tsconfigReferences;
      fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfigData, null, 2), 'utf8');
      console.log(`✅ Synced references for: ${pkgInfo.relativeFromRoot}`);
    }
  } catch (err) {
    console.error(`❌ Error writing tsconfig for ${pkgInfo.relativeFromRoot}:`, err.message);
  }
});

const ROOT_TSCONFIG_PATH = path.join(ROOT_DIR, 'tsconfig.json');

if (fs.existsSync(ROOT_TSCONFIG_PATH)) {
  try {
    const rootRaw = fs.readFileSync(ROOT_TSCONFIG_PATH, 'utf8');
    const cleanJson = rootRaw.replace(/\/\/.*$/gm, '');
    const rootData = JSON.parse(cleanJson);

    // Format all found leaf packages into root reference paths
    const rootReferences = Array.from(allPackages.values()).map(pkg => ({
      path: `./${pkg.relativeFromRoot}`
    })).sort((a, b) => a.path.localeCompare(b.path));

    rootData.references = rootReferences;

    fs.writeFileSync(ROOT_TSCONFIG_PATH, JSON.stringify(rootData, null, 2), 'utf8');
    console.log(`✨ Automatically healed root tsconfig.json with ${rootReferences.length} paths!`);
  } catch (err) {
    console.error('❌ Failed to auto-update root tsconfig.json:', err.message);
  }
}

console.log('TypeScript references synchronization complete!');

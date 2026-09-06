/*
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
// .eslintrc.cjs (Root)
module.exports = {
  root: true, // Crucial: Locks cascading searches to this root level
  ignorePatterns: [
    '.yarn/**',
    '.pnp.*',
    'sync-project-references.js',
    '**/node_modules/**',
    '**/dist/**',
    '**/dist-types/**',
    '**/coverage/**',
    '**/public/**',
  ],
  extends: ['plugin:storybook/recommended'],
  overrides: [
    {
      files: ['scripts/**/*.js', 'test/vitest.setup.ts'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};

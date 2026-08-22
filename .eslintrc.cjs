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
const {
  createConfig,
  createConfigForRole,
} = require('@backstage/cli/config/eslint-factory');

const toArray = value => {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const prefixPattern = (basePath, pattern) => {
  if (!basePath || basePath === '.') {
    return pattern;
  }

  if (pattern.startsWith('!')) {
    return `!${basePath}/${pattern.slice(1)}`;
  }

  return `${basePath}/${pattern}`;
};

const scopedOverrides = (basePath, config) => {
  const {
    overrides = [],
    ignorePatterns: _ignorePatterns,
    ...baseConfig
  } = config;

  return [
    {
      ...baseConfig,
      files: [prefixPattern(basePath, '**/*.{js,jsx,ts,tsx,cjs,mjs}')],
    },
    ...overrides.map(override => {
      const { files, excludedFiles, ...rest } = override;

      return {
        ...rest,
        files: toArray(files).map(file => prefixPattern(basePath, file)),
        ...(excludedFiles
          ? {
              excludedFiles: toArray(excludedFiles).map(file =>
                prefixPattern(basePath, file),
              ),
            }
          : {}),
      };
    }),
  ];
};

module.exports = {
  root: true,
  ignorePatterns: [
    '.yarn/**',
    '.pnp.*',
    '**/node_modules/**',
    '**/dist/**',
    '**/dist-types/**',
    '**/coverage/**',
  ],
  overrides: [
    ...scopedOverrides('.', createConfig(__dirname, { ignorePatterns: [] })),
    ...scopedOverrides(
      'packages/app',
      createConfigForRole(__dirname, 'frontend'),
    ),
    ...scopedOverrides(
      'packages/backend',
      createConfigForRole(__dirname, 'backend'),
    ),
    ...scopedOverrides(
      'plugins/frontend/plugin-ai-crew-suite',
      createConfigForRole(__dirname, 'frontend-plugin'),
    ),
    ...scopedOverrides(
      'plugins/frontend/plugin-ai-agent-frontend-kubernetes-ai-responder',
      createConfigForRole(__dirname, 'frontend-plugin'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend',
      createConfigForRole(__dirname, 'backend-plugin'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-cloud-providers',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-cloud-providers-aws',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-cloud-providers-azure',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-cloud-providers-gcp',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-communication',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-communication-slack',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-compliance',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-compliance-opa',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-incident-management',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-incident-management-pagerduty',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-kubernetes',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-agent-backend-kubernetes-ai-responder',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-agent-backend-catalog-ai-insights',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-agent-backend-oncall-ai-handover-assistant',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-agent-backend-release-notes-ai-generator',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-agent-backend-rfc-adr-ai-reviewer',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-agent-backend-alert-ai-tuner',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/frontend/plugin-ai-agent-frontend-catalog-ai-insights',
      createConfigForRole(__dirname, 'frontend-plugin'),
    ),
    ...scopedOverrides(
      'plugins/frontend/plugin-ai-agent-frontend-oncall-ai-handover-assistant',
      createConfigForRole(__dirname, 'frontend-plugin'),
    ),
    ...scopedOverrides(
      'plugins/frontend/plugin-ai-agent-frontend-release-notes-ai-generator',
      createConfigForRole(__dirname, 'frontend-plugin'),
    ),
    ...scopedOverrides(
      'plugins/frontend/plugin-ai-agent-frontend-rfc-adr-ai-reviewer',
      createConfigForRole(__dirname, 'frontend-plugin'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-llm-aws',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-llm-openai',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-llm-openrouter',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-observability',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-observability-datadog',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-project-management',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-project-management-jira',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-quality-scorecards',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-quality-scorecards-scorecards',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-quality-scorecards-soundcheck',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-quality-scorecards-techradar',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-retrieval-augmenter',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-storage-pgvector',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-storage-qdrant',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-runtime-store',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-vcs',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-vcs-aws-codecommit',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-vcs-azure',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-vcs-bitbucket',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-vcs-gerrit',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-vcs-git',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-vcs-github',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-vcs-gitlab',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-node',
      createConfigForRole(__dirname, 'node-library'),
    ),
    {
      files: ['scripts/**/*.js', 'test/vitest.setup.ts'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};

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
  const { overrides = [], ignorePatterns: _ignorePatterns, ...baseConfig } = config;

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
      'plugins/backend/plugin-ai-core-backend',
      createConfigForRole(__dirname, 'backend-plugin'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-aws',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-cloud-providers',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-collaboration',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-compliance',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-observability',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-openai',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-openrouter',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-pgvector',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-quality-scorecards',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-retrieval-augmenter',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/plugin-ai-core-backend-module-vcs',
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
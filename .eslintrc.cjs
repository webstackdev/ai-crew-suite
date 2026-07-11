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
      'plugins/frontend/rag-ai',
      createConfigForRole(__dirname, 'frontend-plugin'),
    ),
    ...scopedOverrides(
      'plugins/backend/rag-ai-backend',
      createConfigForRole(__dirname, 'backend-plugin'),
    ),
    ...scopedOverrides(
      'plugins/backend/rag-ai-backend-embeddings-aws',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/rag-ai-backend-embeddings-openai',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/rag-ai-backend-retrieval-augmenter',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    ...scopedOverrides(
      'plugins/backend/rag-ai-node',
      createConfigForRole(__dirname, 'node-library'),
    ),
    ...scopedOverrides(
      'plugins/backend/rag-ai-storage-pgvector',
      createConfigForRole(__dirname, 'backend-plugin-module'),
    ),
    {
      files: ['scripts/**/*.js', 'test/vitest.setup.ts'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
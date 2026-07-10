import { FlatCompat } from '@eslint/eslintrc';
import path from 'path';
import { fileURLToPath } from 'url';
import tseslint from 'typescript-eslint';

// Setup __dirname equivalent for ES modules / TypeScript config environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname
});

import backstageEslintFactory from '@backstage/cli/config/eslint-factory';

export default tseslint.config(
  // Ignore global build artifact folders
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-types/**',
      '**/coverage/**'
    ]
  },

  // Wrap ESLint legacy config and apply the Backstage rules dynamically for all source files
  ...compat.config(
    backstageEslintFactory(__dirname)
  ),

  // Overrides for typescript parsing behavior
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json', './plugins/*/tsconfig.json', './packages/*/tsconfig.json'],
      },
    },
  }
);

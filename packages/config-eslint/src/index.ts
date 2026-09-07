/**
 * Copyright 2020 The Backstage Authors
 * Copyright 2026 The AI Crew Suite Authors
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
import { builtinModules } from 'node:module';
import backstagePlugin from '@backstage/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import-x';
import jestPlugin from 'eslint-plugin-jest';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactPlugin from 'eslint-plugin-react';
import storybookPlugin from 'eslint-plugin-storybook';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';

export type PackageRole =
  | 'common-library'
  | 'web-library'
  | 'frontend'
  | 'frontend-plugin'
  | 'frontend-plugin-module'
  | 'backend'
  | 'backend-plugin'
  | 'backend-plugin-module'
  | 'node-library'
  | 'cli'
  | 'cli-module';

/**
 * Global Base Ruleset applied across ALL packages in the monorepo
 */
const getBaseConfigBlock = () => ({
  files: ['**/*.ts', '**/*.tsx'],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    globals: {
      ...globals.es2021,
    },
  },
  plugins: {
    '@typescript-eslint': tsPlugin,
    '@backstage': backstagePlugin,
    'import': importPlugin,
    'unused-imports': unusedImportsPlugin,
  },
  rules: {
    '@typescript-eslint/consistent-type-assertions': 'error',
    '@typescript-eslint/no-redeclare': 'error',
    '@typescript-eslint/no-shadow': 'error',
    '@typescript-eslint/no-unused-expressions': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { vars: 'all', args: 'after-used', ignoreRestSiblings: true, argsIgnorePattern: '^_' },
    ],
    'import/newline-after-import': 'error',
    'no-redeclare': 'off',
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          { group: ['*.stories*', '*.test*', '**/__testUtils__/**', '**/__mocks__/**'] }
        ],
      },
    ],
    'no-shadow': 'off',
    'no-undef': 'off',
    'no-unused-expressions': 'off',
  },
});

/**
 * Main Factory supporting discrete Package Roles in Flat Format
 */
export function createFlatConfigForRole(role: PackageRole, extraOverrides: any[] = []): any[] {
  const globalIgnores = {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/e2e-tests/**']
  };

  const configs: any[] = [
    globalIgnores,
    getBaseConfigBlock()
  ];

  const isFrontend = [
    'web-library',
    'frontend',
    'frontend-plugin',
    'frontend-plugin-module',
  ].includes(role);

  const isBackend = [
    'cli',
    'cli-module',
    'node-library',
    'backend',
    'backend-plugin',
    'backend-plugin-module',
  ].includes(role);

  // -------------------------------------------------------------
  // Frontend/UI Configurations
  // -------------------------------------------------------------
  if (isFrontend) {
    configs.push({
      languageOptions: {
        globals: { ...globals.browser },
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
      plugins: {
        'jsx-a11y': jsxA11yPlugin,
        'react-hooks': reactHooksPlugin,
        'react': reactPlugin,
      },
      settings: {
        react: { version: 'detect' },
      },
      rules: {
        ...jsxA11yPlugin.flatConfigs.recommended.rules,
        'no-restricted-imports': [
          'error',
          {
            paths: [
              { name: '@material-ui/icons', message: "Please import '@material-ui/icons/<Icon>' instead." },
              { name: '@material-ui/icons/', message: "Please import '@material-ui/icons/<Icon>' instead." },
              { name: '@mui/material', message: "Please import '@mui/material/...' instead." },
              ...builtinModules.map(m => ({ name: m, message: 'Node builtins are restricted on the frontend.' })),
            ],
            patterns: [{ group: ['@mui/*/*/*'] }],
          },
        ],
        'no-restricted-syntax': [
          'warn',
          {
            selector: "ImportDeclaration[source.value='react'][specifiers.0.type='ImportDefaultSpecifier']",
            message: 'React default imports are deprecated. Follow the https://backstage.io migration guide for details.',
          },
          {
            selector: "ImportDeclaration[source.value='react'] :matches(ImportDefaultSpecifier, ImportNamespaceSpecifier)",
            message: 'React default imports are deprecated. Follow the https://backstage.io migration guide for details. If you need a global type that collides with a React named export (such as `MouseEvent`), try using `globalThis.MouseHandler`.',
          },
        ],
        'react-hooks/exhaustive-deps': 'warn',
        'react-hooks/rules-of-hooks': 'error',
        'react/react-in-jsx-scope': 'off',
      },
    });

    if (role === 'common-library' || role === 'web-library') {
      configs.push({
        files: ['**/*.ts?(x)'],
        rules: { 'react/prop-types': 'off' },
      });
    }
  }

  // -------------------------------------------------------------
  // Backend/Node Configurations
  // -------------------------------------------------------------
  if (isBackend) {
    configs.push({
      languageOptions: {
        globals: {
          ...globals.node,
          __non_webpack_require__: 'readonly',
        },
      },
      rules: {
        'new-cap': ['error', { capIsNew: false }],
        'no-console': 'off',

        'no-restricted-syntax': [
          'error',
          {
            selector: 'ImportDeclaration[source.value="winston"] ImportDefaultSpecifier',
            message: 'Default import from winston is not allowed, import `* as winston` instead.',
          },
        ],
      },
    });

    configs.push({
      files: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: 'ImportDeclaration[source.value="winston"] ImportDefaultSpecifier',
            message: 'Default import from winston is not allowed, import `* as winston` instead.',
          },
          {
            selector: 'Identifier[name="__dirname"]',
            message: "`__dirname` doesn't refer to the same dir in production builds, try `resolvePackagePath()` from `@backstage/backend-plugin-api` instead.",
          },
        ],
      },
    });
  }

  // -------------------------------------------------------------
  // Storybook Testing Isolation Configuration Block
  // -------------------------------------------------------------
  configs.push({
    files: ['**/*.stories.@(ts|tsx|js|jsx)'],
    plugins: {
      'storybook': storybookPlugin,
    },
    rules: {
      ...storybookPlugin.configs.recommended.rules,
    },
  });

  // -------------------------------------------------------------
  // Test Environment Handling Mapping
  // -------------------------------------------------------------
  configs.push({
    files: [
      '**/*.test.*',
      '**/*.spec.*',
      '**/__mocks__/**',
      '**/__testUtils__/**',
      'src/setupTests.*',
    ],
    plugins: { 'jest': jestPlugin },
    languageOptions: { globals: { ...globals.jest } },
    rules: {
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
    },
  });

  // -------------------------------------------------------------
  // Config Declarations Boundary Enforcements
  // -------------------------------------------------------------
  configs.push({
    files: ['**/config.d.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
    },
  });

  return [...configs, ...extraOverrides, eslintConfigPrettier];
}

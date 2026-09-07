/*
 * Copyright 2026 The AI Crew Suite Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://apache.org
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createFlatConfigForRole } from '@ai-crew-suite/config-eslint';

export default [
  /** Global Ignores Matrix */
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-types/**',
      '**/coverage/**',
      '.yarn/**'
    ]
  },

  /** Global Rule Block for Backend and Core Node Utility Code */
  {
    files: [
      'plugins/backend/**/*.ts',
      'plugins/core/**/*.ts',
      'plugins/tools/**/*.ts',
      'packages/scripts/src/**/*.ts'
    ],
    /** Automatically applies standard 'backend-plugin' role parameters globally */
    ...createFlatConfigForRole('backend-plugin')[0]
  },

  /** Global Rule Block for Frontend UI Components & Web Libraries */
  {
    files: [
      'plugins/frontend/**/*.ts',
      'plugins/frontend/**/*.tsx',
      'apps/backstage/src/**/*.ts',
      'apps/backstage/src/**/*.tsx'
    ],
    /** Automatically applies standard 'frontend-plugin' role parameters globally */
    ...createFlatConfigForRole('frontend-plugin')[0]
  }
];

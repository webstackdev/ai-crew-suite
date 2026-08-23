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
import { fn } from 'storybook/test';

/**
 * Creates a typed Backstage API mock from the methods a story needs to exercise.
 *
 * Keep API-specific fixtures beside their stories; this helper deliberately has
 * no knowledge of individual frontend plugins or their API references.
 */
export const createMockApi = <TApi extends object>(implementations: Partial<TApi>): TApi =>
  implementations as TApi;

/** Creates an action-panel-visible mock function with an optional implementation. */
export const createMockFn = <TFunction extends (...args: never[]) => unknown>(
  implementation?: TFunction
) => fn(implementation) as unknown as TFunction;

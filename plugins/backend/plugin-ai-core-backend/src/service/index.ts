/*
 * Copyright 2024 Larder Software Limited
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
import { createAiBackendServices, createSourceRegistry, resolveConfiguredAgents } from './factory';
import { createRouter } from './router';
import type { AiBackendServiceOptions } from '../@types';

export * from './factory';
export * from './router';
export type * from '../@types';

/**
 * Creates the HTTP router object consumed by Backstage plugin wiring.
 *
 * The return shape matches Backstage backend expectations where a plugin
 * exposes its mounted express router through a `{ router }` object.
 */
export const createApiRoutes = async (options: AiBackendServiceOptions) => {
  const services = createAiBackendServices(options);
  const router = createRouter({
    logger: options.logger,
    config: options.config,
    sourceRegistry: services.sourceRegistry,
    controller: services.controller,
  });
  return { router };
};

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
import { z } from 'zod';
import type { AiAgentSchemaRegistry } from '@webstackbuilders/plugin-ai-core-node';

export const AlertTunerInputSchema = z.object({
  /** The specific catalog microservice or infrastructure component identifier to analyze */
  service: z.string().min(1, 'Target service parameter is required'),
  /** Optional lookback parameter to establish the evaluation historical context window */
  lookbackDays: z.number().int().positive().optional(),
  /** Custom ISO timestamp boundaries to override lookback default bounds */
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).strict(); // Using strict to prevent arbitrary payload parameter pollution

export type AlertTunerInput = z.infer<typeof AlertTunerInputSchema>;

// Inject definition contracts into your global extensible platform registry
declare module '@webstackbuilders/plugin-ai-core-node' {
  interface AiAgentSchemaRegistry {
    'alert-ai-tuner': {
      inputSchema: typeof AlertTunerInputSchema;
      inputType: AlertTunerInput;
    };
  }
}

/**
 * Empty explicit reference assertion that prevents bundlers, linters,
 * and compilers from stripping the unused node package import.
 */
export type RegisteredAlertTunerSchema = AiAgentSchemaRegistry['alert-ai-tuner'];

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
import { LoggerService } from '@backstage/backend-plugin-api';
import { ToolDefinition } from '@webstackbuilders/plugin-ai-core-node';
import { QualityScorecardDriver } from '../providers';

type GetScorecardArgs = { entityRef: string; scorecardId?: string };
type ListChecksArgs = { entityRef: string };
type TechRadarLookupArgs = { name: string };
type ServiceProfileArgs = { entityRef: string };

export const createQualityScorecardTools = (opts: {
  driver: QualityScorecardDriver;
  logger: LoggerService;
}): ToolDefinition[] => {
  const { driver, logger } = opts;

  return [
    {
      id: 'quality.scorecard.get',
      description: 'Fetch scorecard or Soundcheck results for an entity',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as GetScorecardArgs;
        logger.debug('quality.scorecard.get invoked', payload);
        return driver.getScorecard(payload);
      },
    },
    {
      id: 'quality.checks.list',
      description: 'Return failed checks and metadata for an entity',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as ListChecksArgs;
        logger.debug('quality.checks.list invoked', payload);
        return driver.listChecks(payload);
      },
    },
    {
      id: 'quality.tech_radar.lookup',
      description: 'Resolve approved technologies or lifecycle status',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as TechRadarLookupArgs;
        logger.debug('quality.tech_radar.lookup invoked', payload);
        return driver.lookupTechRadar(payload);
      },
    },
    {
      id: 'quality.service_profile.get',
      description: 'Compose catalog metadata, ownership, scorecards, and standards into a normalized quality profile',
      effect: 'read',
      async invoke(args: unknown) {
        const payload = args as ServiceProfileArgs;
        logger.debug('quality.service_profile.get invoked', payload);
        return driver.getServiceProfile(payload);
      },
    },
  ];
};

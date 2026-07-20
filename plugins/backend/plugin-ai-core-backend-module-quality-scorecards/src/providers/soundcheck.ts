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
import {
  CheckSummary,
  QualityScorecardDriver,
  ScorecardResult,
  ServiceProfile,
  TechRadarEntry,
} from './types';

export type SoundcheckDriverConfig = {
  baseUrl?: string;
};

/**
 * Soundcheck-backed quality scorecard driver.
 *
 * This first pass is a stub. A real implementation will wire the Soundcheck
 * API for scorecard and check retrieval.
 */
export class SoundcheckDriver implements QualityScorecardDriver {
  readonly providerId = 'soundcheck';
  private readonly logger: LoggerService;

  constructor(opts: { logger: LoggerService; config?: SoundcheckDriverConfig }) {
    this.logger = opts.logger;
  }

  async getScorecard(input: {
    entityRef: string;
    scorecardId?: string;
  }): Promise<ScorecardResult | undefined> {
    this.logger.debug('SoundcheckDriver.getScorecard stub invoked', input);
    return undefined;
  }

  async listChecks(input: { entityRef: string }): Promise<CheckSummary[]> {
    this.logger.debug('SoundcheckDriver.listChecks stub invoked', input);
    return [];
  }

  async lookupTechRadar(input: { name: string }): Promise<TechRadarEntry | undefined> {
    this.logger.debug('SoundcheckDriver.lookupTechRadar stub invoked', input);
    return undefined;
  }

  async getServiceProfile(input: { entityRef: string }): Promise<ServiceProfile> {
    this.logger.debug('SoundcheckDriver.getServiceProfile stub invoked', input);
    return { entityRef: input.entityRef };
  }
}

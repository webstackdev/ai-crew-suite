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

export type ScorecardResult = {
  entityRef: string;
  scorecardId?: string;
  score?: number;
  status?: 'pass' | 'fail' | 'warn';
  checks?: { id: string; name: string; status: 'pass' | 'fail' | 'warn' }[];
};

export type CheckSummary = {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warn';
  description?: string;
  metadata?: Record<string, string>;
};

export type TechRadarEntry = {
  name: string;
  quadrant?: string;
  ring?: 'adopt' | 'trial' | 'assess' | 'hold';
  status?: string;
};

export type ServiceProfile = {
  entityRef: string;
  name?: string;
  owner?: string;
  scorecard?: ScorecardResult;
  checks?: CheckSummary[];
  techRadar?: TechRadarEntry[];
  metadata?: Record<string, string>;
};

export interface QualityScorecardDriver {
  readonly providerId: string;
  getScorecard(input: { entityRef: string; scorecardId?: string }): Promise<ScorecardResult | undefined>;
  listChecks(input: { entityRef: string }): Promise<CheckSummary[]>;
  lookupTechRadar(input: { name: string }): Promise<TechRadarEntry | undefined>;
  getServiceProfile(input: { entityRef: string }): Promise<ServiceProfile>;
}

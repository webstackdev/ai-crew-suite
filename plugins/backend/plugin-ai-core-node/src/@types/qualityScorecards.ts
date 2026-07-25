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

export type ScorecardFactValue = string | number | boolean | string[] | number[];

export type ScorecardCheckResult = {
  checkId: string;
  name: string;
  description?: string;
  category: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  factValue?: ScorecardFactValue;
  targetValue?: ScorecardFactValue;
  lastEvaluatedAt?: string;
};

export type EntityScorecardSummary = {
  entityRef: string;
  overallStatus: 'passed' | 'failed' | 'warning';
  score?: {
    earned: number;
    possible: number;
  };
  results: ScorecardCheckResult[];
};

export type TechRadarProposalInput = {
  quadrantId: string;
  ringId: string;
  title: string;
  description: string;
  reason: string;
};

export type TechRadarProposalResponse = {
  proposalId: string;
  status: 'submitted' | 'approved' | 'rejected' | 'needs_review';
  message?: string;
};

export type QualityScorecardsConfig = {
  provider: string;
};

export interface QualityScorecardsDriver {
  readonly providerId: string;
  getEntityScorecard(entityRef: string): Promise<EntityScorecardSummary>;
  submitRadarProposal(input: TechRadarProposalInput): Promise<TechRadarProposalResponse>;
}

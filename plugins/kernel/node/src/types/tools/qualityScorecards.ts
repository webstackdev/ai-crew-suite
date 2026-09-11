/*
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

/**
 * ============================================================================
 *   CORE DYNAMIC QUALITY SCORECARDS DRIVER INTERFACE
 * ============================================================================
 */

/**
 * Provider-neutral driver for automated validation, benchmarking, and architectural
 * governance tracking platforms like Backstage Scorecards or Tech Radars.
 *
 * This contract isolates concrete assessment tool API queries cleanly inside independent
 * backend module blocks, providing quality benchmarking for all 18 agentic plugins.
 */
export interface QualityScorecardsDriver {
  /** Unique provider identifier, such as `internal-scorecards` or `roadie-scorecards`. */
  readonly providerId: string;
  /** Fetches a comprehensive architectural health scorecard summary for a given catalog asset reference. */
  getEntityScorecard(entityRef: string): Promise<EntityScorecardSummary>;
  /** Submits an architectural tech stack variance proposal straight to the platform's Tech Radar dashboard. */
  submitRadarProposal(input: TechRadarProposalInput): Promise<TechRadarProposalResponse>;
}

/**
 * ============================================================================
 *   QUALITY SCORECARD DATA STRUCTURES (DTOs)
 * ============================================================================
 */

/**
 * Broad primitive union mapping acceptable evaluation fact metrics.
 */
export type ScorecardFactValue = string | number | boolean | string[] | number[];

/**
 * Normalized summary record tracking an entity's collective evaluation checks.
 */
export type EntityScorecardSummary = {
  /** Target Backstage catalog entity reference string (e.g. `component:default/payment-service`). */
  entityRef: string;
  /** Aggregated benchmark status rating tracking all rule criteria results. */
  overallStatus: 'passed' | 'failed' | 'warning';
  /** Optional overall point scoring tracking metrics. */
  score?: {
    /** Points successfully earned by the asset rules evaluation pass. */
    earned: number;
    /** Maximum total possible target score constraints limit. */
    possible: number;
  };
  /** Deep array collection storing individual rule assertions. */
  results: ScorecardCheckResult[];
};

/**
 * Individual condition verification check record block.
 */
export type ScorecardCheckResult = {
  /** Stable rule or check identifier. */
  checkId: string;
  /** Human-readable title or name of the benchmark rule. */
  name: string;
  /** Optional summary description copy block highlighting the check's verification scope. */
  description?: string;
  /** Domain classification grouping metric (e.g., `security`, `production-readiness`). */
  category: string;
  /** Isolated status outcome tracking this specific rule calculation. */
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  /** The actual calculated live state value extracted out of the repository codebase or metadata. */
  factValue?: ScorecardFactValue;
  /** The target metric boundary baseline required to satisfy compliance rules perfectly. */
  targetValue?: ScorecardFactValue;
  /** ISO-8601 evaluation timestamp. */
  lastEvaluatedAt?: string;
};

/**
 * ============================================================================
 *   TECH RADAR ARCHITECTURAL PROPOSAL STRUCTURES (DTOs)
 * ============================================================================
 */

/**
 * Fields accepted when an agent proposes a tech ecosystem addition or ring update.
 */
export type TechRadarProposalInput = {
  /** Target radar quadrant segment identifier name (e.g., `languages`, `frameworks`). */
  quadrantId: string;
  /** Target radar ring maturity tracking layer identifier (e.g., `adopt`, `trial`, `hold`). */
  ringId: string;
  /** Technology asset or package name title string. */
  title: string;
  /** Contextual overview summary highlighting what the library or stack provides. */
  description: string;
  /** Natural-language justification reasoning explaining why the architecture team should adopt this. */
  reason: string;
};

/**
 * Hydrated workflow result packet returned upon tech radar proposal entry.
 */
export type TechRadarProposalResponse = {
  /** Unique proposal tracking record transaction identifier. */
  proposalId: string;
  /** Lifecycle state assigned to the tracking asset by the governance platform engine. */
  status: 'submitted' | 'approved' | 'rejected' | 'needs_review';
  /** Optional supplemental provider guidance or review notes string. */
  message?: string;
};

/**
 * ============================================================================
 *   ENGINE ASSIGNMENT CONFIGURATION STRUCTURES
 * ============================================================================
 */

/** Baseline selector shape used by engine configurations to track active providers. */
export type QualityScorecardsConfig = {
  /** Identifier of the registered quality driver to activate. */
  provider: string;
};

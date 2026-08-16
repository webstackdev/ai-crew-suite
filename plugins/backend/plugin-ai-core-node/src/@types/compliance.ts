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

/**
 * Result of evaluating a policy against a provider-specific policy engine.
 */
export type PolicyEvaluationResult = {
  /** Policy identifier supplied by the caller. */
  policyId: string;
  /** Whether the evaluated policy permits the supplied input. */
  passed: boolean;
  /** Normalized violations reported by the policy provider. */
  violations?: { rule: string; message: string; severity?: string }[];
  /** Provider response retained for downstream audit enrichment. */
  raw?: unknown;
};

/**
 * Result of an authorization policy check.
 */
export type PermissionCheckResult = {
  /** Whether the requested action is permitted. */
  allowed: boolean;
  /** Provider explanation for a denied request when available. */
  reason?: string;
};

/**
 * Result of validating an architecture or infrastructure proposal.
 */
export type ArchitectureValidationResult = {
  /** Whether the proposal satisfies the configured constraints. */
  valid: boolean;
  /** Constraints violated by the proposal. */
  violations?: { constraint: string; message: string }[];
};

/**
 * Result from a FinOps or governance cost policy.
 */
export type CostEstimateResult = {
  /** Whether the provider returned an estimate. */
  estimated: boolean;
  /** ISO 4217 currency code when an amount is available. */
  currency?: string;
  /** Point estimate when the provider returns one. */
  amount?: number;
  /** Estimate range when the provider returns bounds. */
  range?: { low: number; high: number };
  /** Supplemental provider guidance. */
  notes?: string;
};

/**
 * Provider-neutral driver for governance and policy engines such as Open Policy
 * Agent, enterprise policy registries, or FinOps policy services.
 */
export interface ComplianceDriver {
  /** Unique provider identifier, such as `opa`. */
  readonly providerId: string;
  /** Evaluates IaC, configuration, or a proposed action against a named policy. */
  evaluatePolicy(input: {
    policyId?: string;
    input: unknown;
  }): Promise<PolicyEvaluationResult>;
  /** Evaluates whether a user may perform an action on an optional resource. */
  checkPermission(input: {
    userRef: string;
    action: string;
    resource?: string;
  }): Promise<PermissionCheckResult>;
  /** Validates a proposed architecture or infrastructure design. */
  validateArchitecture(input: {
    proposal: unknown;
  }): Promise<ArchitectureValidationResult>;
  /** Requests a cost estimate or classification for a proposal. */
  estimateCost(input: {
    proposal: unknown;
  }): Promise<CostEstimateResult>;
}

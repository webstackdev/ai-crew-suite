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

export type PolicyEvaluationResult = {
  policyId: string;
  passed: boolean;
  violations?: { rule: string; message: string; severity?: string }[];
  raw?: unknown;
};

export type PermissionCheckResult = {
  allowed: boolean;
  reason?: string;
};

export type ArchitectureValidationResult = {
  valid: boolean;
  violations?: { constraint: string; message: string }[];
};

export type CostEstimateResult = {
  estimated: boolean;
  currency?: string;
  amount?: number;
  range?: { low: number; high: number };
  notes?: string;
};

export interface ComplianceDriver {
  readonly providerId: string;
  evaluatePolicy(input: {
    policyId?: string;
    input: unknown;
  }): Promise<PolicyEvaluationResult>;
  checkPermission(input: {
    userRef: string;
    action: string;
    resource?: string;
  }): Promise<PermissionCheckResult>;
  validateArchitecture(input: {
    proposal: unknown;
  }): Promise<ArchitectureValidationResult>;
  estimateCost(input: {
    proposal: unknown;
  }): Promise<CostEstimateResult>;
}

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
  ArchitectureValidationResult,
  ComplianceDriver,
  CostEstimateResult,
  PermissionCheckResult,
  PolicyEvaluationResult,
} from './types';

export type OpaDriverConfig = {
  baseUrl?: string;
};

/**
 * OPA-backed compliance driver.
 *
 * This first pass is a stub. A real implementation will wire the OPA REST API
 * for policy evaluation.
 */
export class OpaDriver implements ComplianceDriver {
  readonly providerId = 'opa';
  private readonly logger: LoggerService;
  private readonly baseUrl: string;

  constructor(opts: { logger: LoggerService; config?: OpaDriverConfig }) {
    this.logger = opts.logger;
    this.baseUrl = opts.config?.baseUrl ?? '';
  }

  async evaluatePolicy(input: {
    policyId?: string;
    input: unknown;
  }): Promise<PolicyEvaluationResult> {
    this.logger.debug('OpaDriver.evaluatePolicy stub invoked', { policyId: input.policyId });
    return { policyId: input.policyId ?? 'default', passed: true };
  }

  async checkPermission(input: {
    userRef: string;
    action: string;
    resource?: string;
  }): Promise<PermissionCheckResult> {
    this.logger.debug('OpaDriver.checkPermission stub invoked', input);
    return { allowed: true };
  }

  async validateArchitecture(input: {
    proposal: unknown;
  }): Promise<ArchitectureValidationResult> {
    this.logger.debug('OpaDriver.validateArchitecture stub invoked');
    return { valid: true };
  }

  async estimateCost(input: {
    proposal: unknown;
  }): Promise<CostEstimateResult> {
    this.logger.debug('OpaDriver.estimateCost stub invoked');
    return { estimated: false, notes: 'Cost estimation not implemented in stub mode' };
  }
}

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
import { LoggerService } from '@backstage/backend-plugin-api';

/**
 * ============================================================================
 *   CONSTANTS, BRANDS, AND PLATFORM CONFIGURATIONS
 * ============================================================================
 */

/** Provider identifier for a cloud driver. Open string. */
export type CloudProviderId = string & { readonly __brand?: 'CloudProviderId' };

/** Isolated baseline network connectivity settings block. */
export type ProviderConnectionConfig = {
  region?: string;
};

/** Unified platform core fallback routing configurations configuration profile. */
export type CloudProvidersConfig = {
  defaultProvider: CloudProviderId;
  providers: Partial<Record<CloudProviderId, ProviderConnectionConfig>>;
};

/**
 * ============================================================================
 *   CORE DYNAMIC CLOUD DRIVER INTERFACE
 * ============================================================================
 */

/**
 * Provider-neutral driver interface for orchestrating multi-cloud provider resources.
 * This contract isolates concrete SDK calls cleanly inside independent backend module blocks.
 */
export interface CloudProviderDriver {
  readonly providerId: string;

  lookupAccount(input: {
    accountId?: string;
    name?: string;
  }): Promise<CloudAccountSummary | undefined>;

  lookupResource(input: {
    service?: string;
    tags?: Record<string, string>;
    owner?: string;
    catalogEntityRef?: string;
  }): Promise<CloudResourceSummary[]>;

  resourceDependencies(input: {
    resourceId: string;
  }): Promise<CloudDependencySummary>;
}

/**
 * ============================================================================
 *   UNIFIED INFRASTRUCTURE DATA TRANSFER OBJECTS (DTOs)
 * ============================================================================
 */

/** Normalized cloud deployment account parameters. */
export type CloudAccountSummary = {
  id: string;
  name?: string;
  provider: string;
  region?: string;
  metadata?: Record<string, string>;
};

/** Compact, filtered structural cloud asset parameters optimized for prompt contexts. */
export type CloudResourceSummary = {
  id: string;
  type: string;
  provider: string;
  region?: string;
  tags?: Record<string, string>;
  owner?: string;
  catalogEntityRef?: string;
};

/** Traceable graph topological structural mapping link boundaries. */
export type CloudDependencySummary = {
  resourceId: string;
  dependsOn: string[];
  dependedBy: string[];
};

/**
 * ============================================================================
 *   ENGINE ENGINE FACTORY ATTACHMENT HOOKS
 * ============================================================================
 */

/** Options utilized by the core engine plugin to mount these tools inside registries. */
export interface CreateCloudProviderToolsOptions {
  driver: CloudProviderDriver;
  logger: LoggerService;
}

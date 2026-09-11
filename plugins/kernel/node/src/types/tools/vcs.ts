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
import { LoggerService, UrlReaderService } from '@backstage/backend-plugin-api';
import type { ScmIntegrations } from '@backstage/integration';

/**
 * ============================================================================
 *   CONSTANTS, BRANDS, AND PLATFORM CONFIGURATIONS
 * ============================================================================
 */

/**
 * Provider identifier for a VCS driver. Open string (third-party providers assign
 * their own IDs); the registry treats IDs as map keys.
 */
export type VcsProviderId = string & { readonly __brand?: 'VcsProviderId' };

/** Common driver fallback configuration shape. */
export type VcsConfig = {
  /** The actively selected active driver for tools fallback routing. */
  provider: VcsProviderId;
};

/**
 * ============================================================================
 *   CORE DRIVER CONTRACTS & DATA TRANSFER OBJECTS (DTOs)
 * ============================================================================
 */

/**
 * Provider-neutral driver interface for version control system operations.
 */
export interface VcsDriver {
  /** Unique provider identifier, such as `github` or `gitlab`. */
  readonly providerId: string;
  /** Returns metadata for a repository identified by URL or entity ref. */
  getRepositoryMetadata(repoUrl: string): Promise<RepositoryMetadata>;
  /** Reads a file from a repository at the supplied path and optional ref. */
  readFile(repoUrl: string, path: string, ref?: string): Promise<string>;
  /** Searches repository content or metadata when the provider supports it. */
  searchRepository(repoUrl: string, query: string): Promise<RepositorySearchResult[]>;
  /** Returns active pull requests for a repository. */
  listPullRequests(repoUrl: string): Promise<PullRequestSummary[]>;
}

/** Normalized repository metadata returned by VCS drivers. */
export type RepositoryMetadata = {
  owner: string;
  name: string;
  defaultBranch: string;
  provider: string;
  url: string;
  visibility?: 'public' | 'private' | 'internal';
};

/** Normalized pull request record returned by VCS drivers. */
export type PullRequestSummary = {
  number: number | string;
  title: string;
  state: 'open' | 'closed' | 'merged';
  author?: string;
  headBranch?: string;
  baseBranch?: string;
  url?: string;
};

/** Normalized search result returned by VCS drivers. */
export type RepositorySearchResult = {
  path: string;
  line?: number;
  snippet?: string;
  ref?: string;
};

/**
 * ============================================================================
 *   AGENT EXECUTABLE TOOL ARGUMENT SCHEMAS
 * ============================================================================
 */

/**
 * Arguments used by agent workflows to extract specific file buffers from a repository.
 */
export type ReadFileArgs = {
  repoUrl: string;
  path: string;
  ref?: string;
};

/**
 * Arguments used to query baseline system properties from a target repository context.
 */
export type GetMetadataArgs = {
  repoUrl: string;
};

/**
 * Arguments passed to textual pattern indexing actions over repository file boundaries.
 */
export type SearchRepositoryArgs = {
  repoUrl: string;
  query: string;
};

/**
 * Arguments utilized by auditing nodes to loop through pending code review listings.
 */
export type ListPullRequestsArgs = {
  repoUrl: string;
};

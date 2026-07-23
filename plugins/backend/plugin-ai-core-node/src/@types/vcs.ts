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

import { LoggerService, UrlReaderService } from '@backstage/backend-plugin-api';
import type { ScmIntegrations, GithubCredentialsProvider } from '@backstage/integration';

/** Valid active VCS identifiers supported natively by the ecosystem. */
export type VcsProviderId = 'github' | 'gitlab' | 'bitbucket' | 'azuredevops';

export type VcsConfig = {
  /** The actively selected active driver for tools fallback routing. */
  provider: VcsProviderId;
};

/**
 * Normalized repository metadata returned by VCS drivers.
 */
export type RepositoryMetadata = {
  /** Repository owner or organization. */
  owner: string;
  /** Repository name. */
  name: string;
  /** Default branch name, such as `main`. */
  defaultBranch: string;
  /** VCS provider identifier, such as `github` or `gitlab`. */
  provider: string;
  /** Fully-qualified repository URL. */
  url: string;
  /** Repository visibility when available. */
  visibility?: 'public' | 'private' | 'internal';
};

/**
 * Normalized pull request record returned by VCS drivers.
 */
export type PullRequestSummary = {
  /** Pull request number or identifier. */
  number: number | string;
  /** PR title. */
  title: string;
  /** PR state, normalized to open/closed/merged. */
  state: 'open' | 'closed' | 'merged';
  /** Author identifier. */
  author?: string;
  /** Source branch name. */
  headBranch?: string;
  /** Target branch name. */
  baseBranch?: string;
  /** PR URL. */
  url?: string;
};

/**
 * Normalized search result returned by VCS drivers.
 */
export type RepositorySearchResult = {
  /** File path or result name. */
  path: string;
  /** Optional matching line number. */
  line?: number;
  /** Optional snippet of matching content. */
  snippet?: string;
  /** Optional ref or branch where the match was found. */
  ref?: string;
};

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

/** Azure DevOps driver configuration parameters. */
export type AzureDriverOptions = {
  urlReader: UrlReaderService;
  logger: LoggerService;
  integrations: ScmIntegrations;
};

/** GitHub driver configuration parameters. */
export type GitHubDriverOptions = {
  urlReader: UrlReaderService;
  logger: LoggerService;
  integrations: ScmIntegrations;
  credentialsProvider: GithubCredentialsProvider;
};

/** GitLab driver configuration parameters. */
export type GitLabDriverOptions = {
  urlReader: UrlReaderService;
  logger: LoggerService;
  integrations: ScmIntegrations;
};

/** Bitbucket driver configuration parameters. */
export type BitbucketDriverOptions = {
  urlReader: UrlReaderService;
  logger: LoggerService;
  integrations: ScmIntegrations;
};

/** Gerrit driver configuration parameters. */
export type GerritDriverOptions = {
  urlReader: UrlReaderService;
  logger: LoggerService;
  integrations: ScmIntegrations;
};

/** Generic Git driver configuration parameters. */
export type GenericGitDriverOptions = {
  urlReader: UrlReaderService;
  logger: LoggerService;
  integrations: ScmIntegrations;
};

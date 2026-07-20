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
import {
  PullRequestSummary,
  RepositoryMetadata,
  RepositorySearchResult,
  VcsDriver,
} from './types';

export type GitHubDriverConfig = {
  host?: string;
  apiBaseUrl?: string;
};

export class GitHubDriver implements VcsDriver {
  readonly providerId = 'github';
  private readonly urlReader: UrlReaderService;
  private readonly logger: LoggerService;
  private readonly host: string;

  constructor(opts: {
    urlReader: UrlReaderService;
    logger: LoggerService;
    config?: GitHubDriverConfig;
  }) {
    this.urlReader = opts.urlReader;
    this.logger = opts.logger;
    this.host = opts.config?.host ?? 'github.com';
  }

  async getRepositoryMetadata(repoUrl: string): Promise<RepositoryMetadata> {
    const parsed = this.parseRepoUrl(repoUrl);
    return {
      owner: parsed.owner,
      name: parsed.name,
      defaultBranch: 'main',
      provider: this.providerId,
      url: repoUrl,
    };
  }

  async readFile(repoUrl: string, path: string, ref?: string): Promise<string> {
    const parsed = this.parseRepoUrl(repoUrl);
    const refSegment = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const fileUrl = `https://${this.host}/${parsed.owner}/${parsed.name}/blob/${ref ?? 'HEAD'}/${path.replace(/^\//, '')}${refSegment}`;
    this.logger.debug(`GitHubDriver reading ${fileUrl}`);
    const response = await this.urlReader.readUrl(fileUrl);
    const buffer = await response.buffer();
    return buffer.toString('utf8');
  }

  async searchRepository(
    _repoUrl: string,
    _query: string,
  ): Promise<RepositorySearchResult[]> {
    return [];
  }

  async listPullRequests(_repoUrl: string): Promise<PullRequestSummary[]> {
    return [];
  }

  private parseRepoUrl(repoUrl: string): { owner: string; name: string } {
    const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/i);
    if (!match) {
      throw new Error(`GitHubDriver could not parse repository URL: ${repoUrl}`);
    }
    return { owner: match[1], name: match[2] };
  }
}

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
import {
  CodeCommitClient,
  GetRepositoryCommand,
  GetFileCommand,
  ListPullRequestsCommand,
  GetPullRequestCommand
} from '@aws-sdk/client-codecommit';
import { LoggerService, UrlReaderService } from '@backstage/backend-plugin-api';
import { ScmIntegrations, AwsCodeCommitIntegration } from '@backstage/integration';
import {
  VcsDriver,
  RepositoryMetadata,
  RepositorySearchResult,
  PullRequestSummary
} from '@webstackbuilders/plugin-ai-core-node';

export type AwsCodeCommitDriverOptions = {
  urlReader: UrlReaderService;
  logger: LoggerService;
  integrations: ScmIntegrations;
};

export class AwsCodeCommitDriver implements VcsDriver {
  readonly providerId = 'aws-codecommit';
  private readonly urlReader: UrlReaderService;
  private readonly logger: LoggerService;
  private readonly integrations: ScmIntegrations;

  constructor(opts: AwsCodeCommitDriverOptions) {
    this.urlReader = opts.urlReader;
    this.logger = opts.logger;
    this.integrations = opts.integrations;
  }

  /**
   * Helper to resolve the correct integration and configure the native AWS CodeCommit SDK client
   */
  private getClientForRepo(repoUrl: string): { client: CodeCommitClient; repoName: string; region: string } {
    const integration = this.integrations.awsCodeCommit?.byUrl(repoUrl);
    if (!integration) {
      throw new Error(`No AWS CodeCommit integration found configured for URL: ${repoUrl}`);
    }

    let region = 'us-east-1';
    let repoName = '';

    try {
      const urlObj = new URL(repoUrl);
      // Host shape: ://amazonaws.com
      const hostParts = urlObj.host.split('.');

      if (hostParts.length > 1 && hostParts[0] !== 'codecommit') {
        // Extracts region out of codecommit.us-east-1.amazonaws.com
        region = hostParts[1];
      }

      // Path shape: /v1/repos/my-repo-name
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      repoName = pathParts[pathParts.length - 1].replace(/\.git$/, '');

      if (!repoName) throw new Error();
    } catch {
      throw new Error(`AwsCodeCommitDriver could not parse repository URL: ${repoUrl}`);
    }

    // The AWS SDK automatically handles environmental IAM roles, access keys, or 
    // explicit credentials blocks defined in the integration configuration block.
    const client = new CodeCommitClient({
      region,
      credentials: integration.config.accessKeyId && integration.config.secretAccessKey ? {
        accessKeyId: integration.config.accessKeyId,
        secretAccessKey: integration.config.secretAccessKey,
      } : undefined,
    });

    return { client, repoName, region };
  }

  async getRepositoryMetadata(repoUrl: string): Promise<RepositoryMetadata> {
    const { client, repoName, region } = this.getClientForRepo(repoUrl);
    
    const command = new GetRepositoryCommand({ repositoryName: repoName });
    const response = await client.send(command);
    const repoMetadata = response.repositoryMetadata;

    return {
      owner: region, // AWS scales resources relative to Region isolation profiles
      name: repoName,
      defaultBranch: repoMetadata?.defaultBranch ?? 'main',
      provider: this.providerId,
      url: repoUrl,
    };
  }

  async readFile(repoUrl: string, path: string, ref?: string): Promise<string> {
    const { client, repoName } = this.getClientForRepo(repoUrl);
    const cleanPath = path.replace(/^\//, '');

    try {
      // CodeCommit files are retrieved by path from a specific commit reference or branch HEAD
      const command = new GetFileCommand({
        repositoryName: repoName,
        filePath: cleanPath,
        commitSpecifier: ref ?? 'HEAD',
      });

      const response = await client.send(command);

      if (!response.fileContent) {
        throw new Error('File content empty');
      }

      // AWS CodeCommit returns file arrays as pure Uint8Arrays / Buffers
      return Buffer.from(response.fileContent).toString('utf8');
    } catch (error: any) {
      this.logger.error(`AwsCodeCommitDriver failed to read path ${cleanPath}: ${error.message}`);
      throw error;
    }
  }

  async searchRepository(_repoUrl: string, query: string): Promise<RepositorySearchResult[]> {
    this.logger.warn(`Search requested on AWS CodeCommit for query: "${query}". Fallback array returned.`);
    return [];
  }

  async listPullRequests(repoUrl: string): Promise<PullRequestSummary[]> {
    const { client, repoName } = this.getClientForRepo(repoUrl);

    // 1. Fetch active open pull requests IDs for the target repository
    const listCommand = new ListPullRequestsCommand({
      repositoryName: repoName,
      pullRequestStatus: 'OPEN',
      maxResults: 20,
    });
    const listResponse = await client.send(listCommand);
    const prIds = listResponse.pullRequestIds ?? [];

    // 2. Hydrate each pull request record concurrently to extract targets
    const summaries = await Promise.all(
      prIds.map(async (id) => {
        const getCommand = new GetPullRequestCommand({ pullRequestId: id });
        const prResponse = await client.send(getCommand);
        const pr = prResponse.pullRequest;

        // Target metadata is extracted out of the first active target array entry
        const target = pr?.pullRequestTargets?.[0];

        return {
          number: id,
          title: pr?.title ?? '',
          headBranch: target?.sourceReference?.replace('refs/heads/', '') ?? '',
          baseBranch: target?.destinationReference?.replace('refs/heads/', '') ?? '',
          state: 'open' as const,
          url: `${repoUrl}/pull-request/${id}`,
          author: pr?.authorArn?.split('/').pop(),
        };
      })
    );

    return summaries;
  }
}

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
import { describe, expect, it, vi } from 'vitest';
import { GitHubDriver } from '../github';

const createMockUrlReader = (content: string) => ({
  readUrl: vi.fn().mockResolvedValue({
    buffer: () => Promise.resolve(Buffer.from(content, 'utf8')),
  }),
});

const createMockLogger = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

describe('GitHubDriver', () => {
  it('parses a github.com repository URL into owner and name', async () => {
    const driver = new GitHubDriver({
      urlReader: createMockUrlReader('') as never,
      logger: createMockLogger() as never,
    });
    const metadata = await driver.getRepositoryMetadata(
      'https://github.com/webstackdev/ai-crew-suite',
    );
    expect(metadata.owner).toBe('webstackdev');
    expect(metadata.name).toBe('ai-crew-suite');
    expect(metadata.provider).toBe('github');
  });

  it('throws when the repository URL cannot be parsed', async () => {
    const driver = new GitHubDriver({
      urlReader: createMockUrlReader('') as never,
      logger: createMockLogger() as never,
    });
    await expect(
      driver.getRepositoryMetadata('https://example.com/not-a-repo'),
    ).rejects.toThrow(/could not parse repository URL/);
  });

  it('reads a file through the Backstage urlReader', async () => {
    const urlReader = createMockUrlReader('file contents');
    const driver = new GitHubDriver({
      urlReader: urlReader as never,
      logger: createMockLogger() as never,
    });
    const content = await driver.readFile(
      'https://github.com/webstackdev/ai-crew-suite',
      'README.md',
    );
    expect(content).toBe('file contents');
    expect(urlReader.readUrl).toHaveBeenCalledWith(
      expect.stringContaining('webstackdev/ai-crew-suite/blob/HEAD/README.md'),
    );
  });

  it('returns an empty array for searchRepository in the first pass', async () => {
    const driver = new GitHubDriver({
      urlReader: createMockUrlReader('') as never,
      logger: createMockLogger() as never,
    });
    const results = await driver.searchRepository(
      'https://github.com/webstackdev/ai-crew-suite',
      'test query',
    );
    expect(results).toEqual([]);
  });

  it('returns an empty array for listPullRequests in the first pass', async () => {
    const driver = new GitHubDriver({
      urlReader: createMockUrlReader('') as never,
      logger: createMockLogger() as never,
    });
    const results = await driver.listPullRequests(
      'https://github.com/webstackdev/ai-crew-suite',
    );
    expect(results).toEqual([]);
  });
});

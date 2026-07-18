---
plugin_name: release-notes-ai-generator
category: Pull Request Workflows
subcategory: Product & Delivery
---

# Automated Release Notes

- **The Task:** Generating customer-facing release notes from merged PRs.
- **The Logic:** An agent aggregates all merged PRs since the last tag and generates [customer-facing release notes](https://aakashgupta.medium.com/21-ai-agent-use-cases-that-make-pms-10x-more-productive-most-pms-use-zero-47982523a75f).
- **Framework:** **LangGraph** for the gather → categorize → summarize → publish flow.

## Dependencies & Mock Targets

This assistant executes a **linear-to-cyclic orchestration workflow** that aggregates git deltas, categorizes enhancements using user-defined taxonomies, filters out internal code modifications, and commits the publication artifact back to the developer workspace or content delivery pipeline.

### 1. Core Backstage Services (`coreServices`)

- **`coreServices.urlReader`**: Crucial for looking up previous project configurations, reading project tracking tags, and locating configuration files like `mkdocs.yml` or standard change log targets.
- **`coreServices.database`**: Manages the persistent session states, LangGraph run checkpoints, token/cost auditing metrics, and stages release notes drafts for human review.
- **`coreServices.scheduler`**: Powers automated scheduling configurations if notes are generated periodically (e.g., every Friday at 17:00 or concurrently with nightly builds).

### 2. Sibling Plugins & Data Sources

- **`GithubBackend` / `GithubService` (or GitLab equivalents)**: The primary historical data extraction pool. The agent calls this service to fetch tag deltas, list merged pull requests within the target window, and read commit messages. It also uses this service to publish the final artifact to GitHub Releases.
- **Jira / Linear Plugins**: Cross-referenced by the agent to translate cryptic PR titles into descriptive customer feature terms by reading the associated epic or user story description fields.

## Testing Strategy

The **LangGraph** flow follows a _gather → categorize → summarize → publish_ structure. Your integration tests must verify that the graph isolates development tasks (e.g., `"chore: fix typo in README"`) from user-facing feature additions, and that it correctly halts for approval before creating a live production release tag.

### 1. Testing the Isolation and Categorization Logic

You can validate that the graph's internal nodes correctly process diverse git text patterns by providing a deterministic, mocked commit history within your test configuration wrapper.

Inject these dependencies into your Backstage backend test harness using custom service factories:

```typescript
import {
  createServiceFactory,
  createServiceRef,
} from '@backstage/backend-plugin-api';
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import { releaseNotesAiGeneratorPlugin } from '../plugin';

// 1. Mock the GitHub service to provide a raw mixture of pull request metadata
const mockGithubReleaseHistoryFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'github.service' }),
  deps: {},
  async factory() {
    return {
      getMergedPrsSinceLastTag: async (repoSlug: string) => [
        {
          id: '101',
          title: 'feat(auth): add multi-factor authentication fallback',
          body: 'Closes JIRA-432',
        },
        {
          id: '102',
          title: 'chore: bump package versions for security patches',
          body: '',
        },
        {
          id: '103',
          title: 'fix(ui): repair color contrast alignment on sidebar buttons',
          body: 'Closes JIRA-877',
        },
      ],
      publishReleaseNotes: async (
        repoSlug: string,
        tag: string,
        markdown: string,
      ) => ({ status: 'RELEASE_PUBLISHED_201' }),
    };
  },
});

// 2. Mock the Jira service to resolve issue details for associated tickets
const mockJiraIssueFactory = createServiceFactory({
  service: createServiceRef<any>({ id: 'jira.service' }),
  deps: {},
  async factory() {
    return {
      getIssueDetails: async (ticketKey: string) => {
        if (ticketKey === 'JIRA-432') {
          return {
            summary:
              'MFA Fallback Authentication support for enterprise users.',
          };
        }
        return {
          summary:
            'Accessibility update regarding WCAG color contrast criteria.',
        };
      },
    };
  },
});

// 3. Execute the LangGraph workflow validation
describe('Automated Release Notes LangGraph execution', () => {
  it('should ignore internal chores, resolve ticket summaries, and hold for human sign-off', async () => {
    const { server } = await startTestBackend({
      features: [
        releaseNotesAiGeneratorPlugin(),
        mockGithubReleaseHistoryFactory(),
        mockJiraIssueFactory(),
        mockServices.database.factory(), // Tracks LangGraph workflow state persistence
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    // Step A: Trigger an evaluation by posting a run request payload via supertest to the plugin router.
    // Step B: Assert that the LangGraph completes categorization and pauses at the human approval gate.
    // Step C: Verify the SQLite/PostgreSQL layer contains an active checkpoint showing that the chore PR was filtered out.
    // Step D: Put an approval command to the resume route; assert the graph completes the publishReleaseNotes call.
  });
});
```

### 2. Validating SSE Streaming for Complex Summaries

Because compiling documentation takes time, ensure that your frontend Server-Sent Events (SSE) stream remains stable while the agent transitions between data gathering nodes and multi-document text summarization blocks. Re-use your platform's custom test-fixtures schema to check that your step logs explicitly track when the _summarize_ node finishes compiling individual categories before generating the final combined markdown file.

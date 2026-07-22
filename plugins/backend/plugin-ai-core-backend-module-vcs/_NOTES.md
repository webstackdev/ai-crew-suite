# VCS Provider Notes

## Planned Agentic Workflow Plugins Consuming VCS Sibling Plugins

The following proposed agentic workflow plugins consume this plugin:

- `alert-ai-tuner`: Used by the final node to create a branch, update the Terraform source files, and open a Pull Request against the infrastructure repository.
- `kubernetes-ai-responder`: Used by the agent to fetch the git commit history and recent Pull Requests for the component to see if a recent code deployment correlates with the incident window.
- `oncall-ai-handover-assistant`: Scanned to pull a history of merged PRs, configuration-as-code changes, or emergency patches pushed to production.
- `release-notes-ai-generator`: The primary historical data extraction pool. The agent calls this service to fetch tag deltas, list merged pull requests within the target window, and read commit messages. It also uses this service to publish the final artifact to GitHub Releases.
- `rfc-adr-ai-reviewer`: Used to write markdown comments directly to the open Pull Request or file trackable issues against the design repository.
- `scaffolder-ai-drift-detector`: Target for the final tool nodes to automatically commit the auto-sync remediation pull request once user approval is cleared.
- `scaffolder-ai-intent`: Used by the validation node to inspect infrastructure targets and make sure destination repository names or cloud keys are structurally valid.
- `search-ai-archeology`: Used by the toolpack layer to issue localized, time-bounded commands like extracting a `git blame` matrix or pulling PR code review participant trails from a specific year.
- `search-ai-context`: Used by the static validation nodes to execute localized repository searches or pull down specific consumer files to verify if they make use of the deprecated API fields.
- `tech-radar-ai-manager`: Used to hook into a broad organization commit stream or search code history across the entire GitHub workspace.

## Official VCS Plugins

### GitHub

- **@backstage/plugin-catalog-backend-module-github**: Official core catalog plugin used to discover and dynamically ingest `catalog-info.yaml` configurations from GitHub Organizations or Apps.
- **@backstage/plugin-scaffolder-backend-module-github**: Official core scaffolder action module containing automation actions like `publish:github` or `publish:github:pull-request` for repo creation.

### GitLab

- **@backstage/plugin-catalog-backend-module-gitlab**: Official core backend catalog provider for discovering entities across self-hosted or cloud GitLab groups.
- **@backstage/plugin-scaffolder-backend-module-gitlab**: Official core module used by the template engine to initialize or publish directly into GitLab projects.

### Bitbucket

- **@backstage/plugin-catalog-backend-module-bitbucket-cloud** / **-bitbucket-server**: Official backend catalog ingestion modules targeting either Bitbucket Cloud API formats or on-premise Data Centers.
- **@backstage/plugin-scaffolder-backend-module-bitbucket** / **-bitbucket-server**: Official backend task automations containing target actions like `publish:bitbucketCloud` for scaffolding templates.
- **@backstage-community/plugin-bitbucket-pull-requests**: The standard community portal addition that registers active PR boards to catalog views.

### Azure DevOps

- **@backstage/plugin-catalog-backend-module-azure**: Official backend engine providing automatic repository scanning based on ADO Code Search utilities.
- **@backstage/plugin-scaffolder-backend-module-azure**: Official backend template execution tool designed to programmatically establish new repos and push initialized templates inside ADO Organizations.
- **@backstage-community/plugin-azure-devops**: The primary, unified community workspace package containing both the frontend portal views and backend request-proxy extensions.

### AWS CodeCommit

- **@backstage/plugin-catalog-backend-module-aws-codecommit**, serving standard AWS-native cloud repositories.

### Gerrit

- **@backstage/plugin-catalog-backend-module-gerrit**, allowing code-review platform synchronization.

### Generic Git Providers

- Fallback mechanism mapping raw Git paths (`.git` references over SSH/HTTPS) using standard handlers embedded in **@backstage/integration**.

## Implementation Plan

Our goal with the `plugin-ai-core-backend-module-vcs` is to make use of the existing VCS provider plugins that end users may already have installed, by making use of the extension points those plugins provide.

There are ten of our proposed plugins we've identified that will consume the VCS plugins listed in the first section of this document.

I've listed the various official VCS plugins that are available in the following sections. Let's start with our implementation of the stub `plugins/backend/plugin-ai-core-backend-module-cloud-providers/src/providers/aws.ts` driver.

In the next section, please add an implementation plan and any notes you may have for the AWS driver in this plugin. Let's discuss and identify open issues, what AWS official plugins might be involved, if they should be installed in this package or elsewhere in the repo, and any other issues you can identify before we begin an implementation plan.

### Your Implementation Plan

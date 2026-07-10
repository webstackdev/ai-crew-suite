# Contributing to Webstackbuilders AI Crew Suite

We want to build a collaborative community of contributors dedicated to delivering highly specialized, production-ready AI and RAG plugins for Backstage.

Contributions are welcome and deeply appreciated. Every adjustment helps shape the future of AI orchestration within the platform ecosystem. While we align closely with the architectural values of the core [Backstage Contribution Guidelines](https://github.com/backstage/backstage/blob/master/CONTRIBUTING.md), please adhere to the specific local development workflows and technical standards defined below.

## Types of Contributions

### Report bugs

Help us maintain stability by opening a structured issue in our GitHub issue tracker. Ensure you include:

- The exact version of the specific backend or frontend plugin experiencing the bug.
- Step-by-step reproduction instructions and your environment profile (e.g., Host OS, Node version).
- Relevant stack traces or log blocks outputted by the Backstage runner.

### Build features or submit fixes

Browse our open issue board for active tasks, or contribute fixes for problems you experience locally. If you are proposing a new feature or structural plugin architecture change:

- Open a descriptive issue first to discuss the engineering context before writing code.
- Keep pull request scopes as narrow as possible to ensure rapid review and testing passes.

## Development Environment Setup

This repository utilizes a modernized toolchain tailored to high-performance plugin distribution.

### Core engine requirements

Your local machine must meet these minimum version baselines to pass pre-commit and compilation loops:

- **Node.js**: `v22.11.0` or newer (Active LTS).
- **Yarn Manager**: `v4.17.0` or newer (Plug'n'Play enabled).
- **Git**: `v2.32.0` or newer.

### Local initialization workflow

Because this repository implements **Yarn Plug'n'Play (PnP)**, packages are managed as optimized zip archives rather than a traditional physical `node_modules` directory. Initialize your environment by running:

```bash
# Register the local binary and sync dependencies cleanly
yarn install
```

To ensure code completion and type definitions resolve properly inside your editor, install the Yarn SDK:

```bash
# Generate the editor runtime wrappers
yarn dlx @yarnpkg/sdks vscode
```

_Note: Once complete, open any TypeScript file, launch your VS Code Command Palette (`Ctrl+Shift+P`), choose "TypeScript: Select TypeScript Version", and select "Use Workspace Version". Additionally, verify that you have the `arcanis.vscode-zipfs` extension enabled._

## Quality and Verification Standards

We enforce a unified verification matrix across all sub-workspaces using root infrastructure orchestration tools. Before submitting a pull request, your changes must pass the local staging tasks.

### Code quality checks

We leverage a centralized ESLint flat configuration file (`eslint.config.ts`) that enforces styling via Prettier rules in an atomic, single pass. Run the codebase linter via:

```bash
yarn lint
```

### TypeScript compilation

Verify that your changes satisfy strict generic boundaries and type constraints across both frontend and backend modules:

```bash
yarn tsc
```

### Testing pipeline

Our testing environment leverages Jest asynchronous workers to validate logic blocks concurrently:

```bash
yarn test
```

## Creating Changesets

We use Atlassian **Changesets** to automate version management, update changelogs, and prepare workspace releases smoothly. Every pull request that introduces functional modifications to a published package inside the `plugins/` folder must include a companion changeset file.

### How to generate a changeset

1. Execute the tool from your repository root terminal:

```bash
yarn changeset
```

2. Select the specific sub-packages impacted by your code modifications.
3. Choose the semantic impact tier (**major**, **minor**, or **patch**). Since our project enforces strict boundaries, use `major` strictly for breaking structural API changes, `minor` for backwards-compatible features, and `patch` for bug fixes.
4. Compose a clear description of your changes within the generated markdown file template.
5. Add the newly generated file directly to your Git staging branch and push it alongside your pull request commit.

## Code of Conduct & Security

- **Code of Conduct**: All contributors are required to uphold our community standards. Review our detailed protocols inside [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). For safety concerns, contact **conduct@webstackbuilders.com**.
- **Vulnerability Disclosure**: If you discover a security vulnerability, do not open a public issue. Review our disclosure steps inside [SECURITY.md](SECURITY.md) and report it securely to **security@webstackbuilders.com**.

# GitHub Actions Issues to Verify

## Playwright Configuration

- Current `playwright.config.ts` uses `yarn start` and `yarn start-backend` commands
- Verify these start both Backstage frontend and backend correctly
- Test the new workflow locally if possible

## Secrets & Permissions

- `secrets.NPM_AUTH_TOKEN` needed for publishing to npm
- `secrets.WORKFLOW_GITHUB_TOKEN` needed for automated dependency PRs
- `secrets.SLACK_WEBHOOK_URL` for notifications (optional but configured)

## Changeset Workflow

- The `.changeset` directory was empty - you'll need to add changeset files (`yarn changeset`) for versioning to work
- The publish workflow depends on Changesets detecting version bumps

## Backstage-Specific Considerations

- Port `3000` for frontend and `7007` for backend should match your Backstage setup
- Ensure agent plugins build correctly in the monorepo context

## Specific Recommendations for Agent Plugins

- __Consider plugin-specific E2E tests__ beyond the basic app test
- __Agent integration tests__ for verifying AI agent workflows
- __Backstage compatibility testing__ - ensure plugins work with Backstage's plugin system
- __Agent deployment workflows__ if agents need separate deployment processes

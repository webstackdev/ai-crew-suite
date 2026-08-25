
# Local GitHub Actions runner

This folder contains a small Python runner that executes workflows locally using `gh act`. The runner uses [nektos act](https://nektosact.com/).

It is intended for local debugging of GitHub Actions only. It is not an end-to-end (E2E) test harness: workflows can have real side effects (deployments, comments, API calls, etc.) and may touch the real GitHub repository.

## Usage

Run a single workflow by name (the name is the workflow filename without extension from `.github/workflows/*.yml`):

```bash
npm run debug:action -- <workflowName>
```

Example:

```bash
npm run debug:action -- cron
```

Run all workflows (mostly useful when iterating on the runner itself):

```bash
npm run debug:action
```

## Events

The runner chooses the event to run based on the workflow's `on:` block.
If multiple events are present, it prefers them in this order:

- `workflow_dispatch`
- `pull_request`
- `push`
- `workflow_run`
- `schedule`

Event payload files live in `.github/test/events/`.

- `push`: `.github/test/events/push.events.json`
- `pull_request`: `.github/test/events/pull_request.events.json`
- `workflow_dispatch`: `.github/test/events/workflow_dispatch.events.json`
- `workflow_run`: `.github/test/events/workflow_run.events.json`

If an event payload file is missing, the runner will create a minimal `{}` payload.

### Running a workflow as `push`

If a workflow supports `workflow_dispatch`, the runner will select that event instead of `push`.
To run the same workflow as `push` you have two options:

- Temporarily remove `workflow_dispatch` from the workflow while debugging locally.
- Run `gh act` directly.

Example (manual):

```bash
gh act push \
  --verbose \
  --pull=false \
  -W .github/workflows/<workflowName>.yml \
  -e .github/test/events/push.events.json \
  --var-file .github/test/env/.env.github.testing.variables
```

## Local env files

The `.github/test/env/*.env*` files are gitignored.
Create them locally with values appropriate for your machine.

### Required

- `.github/test/env/.env`
  - Must contain `GITHUB_TOKEN=...`.
  - The runner only reads the token from this file (it does not fall back to your process environment or `gh auth token`).
- `.github/test/env/.env.github.testing.variables`
  - Variables file passed to `gh act` for jobs that do not specify an `environment:`.

### Optional

- `.github/test/env/.env.github.<environment>.variables`
  - Variables file passed to `gh act` for jobs whose `environment:` matches `<environment>`.
- `.github/test/env/.env.github.<environment>.secrets`
  - Secrets file used to populate `gh act` secrets for that environment.
  - Note: `GITHUB_TOKEN` is special-cased and cannot be overridden by environment secret files.

### workflow_dispatch inputs

If a workflow has `workflow_dispatch.inputs`, the runner will look for an inputs file:

- Per-workflow: `.github/test/inputs/<workflowName>.json`
- Generic fallback: `.github/test/inputs/generic.json`

```json
{
  "inputs": {
    "NAME": "Manual Workflow",
    "SOME_VALUE": "ABC"
  }
}
```

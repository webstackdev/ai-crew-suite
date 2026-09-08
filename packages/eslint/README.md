# AI Crew Suite ESLint Config

This plugin exists to allow ESLint's new `flatConfig` to be used in the project, and an entirely ESM setup. The `backstage-cli` package includes linting configuration used across the Backstage core project and in most third-party plugins. It depends on three internal Spotify ESLint configuration plugins that are all CJS. To ensure that AI Crew Suite stays in sync with any linting standard changes the Backstage project may make, there is a GitHub workflow action in this repo that uses CoPilot LLM to compare any changes made to the `backstage-cli` linter config against the config in this plugin, and flag it on PRs when the `backstage-cli` package is upgraded.

## Consuming this package

This package is intended to be consumed from other workspace packages and plugins without adding local ESLint config files.

Install `@ai-crew-suite/config-eslint` as a dependency in the package or plugin that wants to lint with the shared rules.

Use the package-provided wrapper in the consumer package's `package.json`:

```json
{
  "scripts": {
    "lint": "ai-crew-eslint --role node-library src --max-warnings 0"
  }
}
```

The wrapper resolves the compiled ESLint flat config from this package and forwards the remaining CLI arguments to ESLint.

## Available roles

The wrapper supports the following `--role` values:

- `node-library`
- `web-library`
- `backend`
- `backend-plugin`
- `backend-plugin-module`
- `frontend`
- `frontend-plugin`
- `frontend-plugin-module`
- `cli`
- `cli-module`
- `common-library`

Short aliases are also supported:

- `node` maps to `node-library`
- `web` maps to `web-library`

In practice, the most common commands are:

```json
{
  "scripts": {
    "lint": "ai-crew-eslint --role node-library src --max-warnings 0"
  }
}
```

```json
{
  "scripts": {
    "lint": "ai-crew-eslint --role web-library src --max-warnings 0"
  }
}
```

For packages that do not lint `src`, replace `src` with whatever path or file glob should be passed through to ESLint.

## Development notes

This is a TypeScript package. Source files live under `src`, and the build emits runnable JavaScript into `dist`.

Important runtime entrypoints are compiled from TypeScript and published from `dist`:

- the `ai-crew-eslint` bin
- the role-based package config entrypoints
- the monorepo config entrypoint

That means changes to config entrypoints, package exports, or the CLI wrapper should be made in `src`, not by adding handwritten `.mjs` files at the package root.

## Local workflow

Useful commands while developing on this package:

```bash
yarn turbo run build --filter=@ai-crew-suite/config-eslint
yarn turbo run lint --filter=@ai-crew-suite/config-eslint
yarn turbo run test:unit --filter=@ai-crew-suite/config-eslint
yarn turbo run typecheck --filter=@ai-crew-suite/config-eslint
```

To validate a consumer package against the shared config, run its lint target through Turbo. Example:

```bash
yarn turbo run lint --filter=@ai-crew-suite/<my-package>
```

If you change `bin`, `exports`, or dependency wiring in this package's `package.json`, run a workspace install so Yarn refreshes the linked binary metadata:

```bash
yarn install --mode=skip-build
```

# AI Crew Suite Vitest Config

This plugin provides a consumable configuration for using the Vitest test runner and assertions library with AI Crew Suite.

## Consuming this package

This package is intended to be consumed from other workspace packages and plugins without adding local Vitest config files in each package or plugin.

The monorepo setup does not expose Vitest tokens (`describe`, `it`, `expect`, etc.) as globals. Tests files need to import them. Use the Yarn catalog entry for Vitest to allow maintaining the Vitest version in a single place (`.yarnrc.yml`):

```json
  "devDependencies": {
    "vitest": "catalog:vitest"
  }
```

The shared repository config lives at `test/vitest.config.ts` and imports this package's factory.

Install `@ai-crew-suite/config-vitest` as a dependency in the package or plugin that wants to run unit tests with the shared rules.

Use a `test:unit` script in the consumer package's `package.json` that points at the shared root config:

```json
{
  "scripts": {
    "test:unit": "vitest run"
  }
}
```

## Development notes

This is a TypeScript package. Source files live under `src`, and the build emits runnable JavaScript into `dist`.

## Local workflow

Useful commands while developing on this package:

```bash
yarn turbo run build --filter=@ai-crew-suite/config-vitest
yarn turbo run lint --filter=@ai-crew-suite/config-vitest
yarn turbo run test:unit --filter=@ai-crew-suite/config-vitest
yarn turbo run typecheck --filter=@ai-crew-suite/config-vitest
```

To run units in a consumer package against the shared config, run its `test:unit` target through Turbo. Example:

```bash
yarn turbo run test:unit --filter=@ai-crew-suite/<my-package>
```

If you change `bin`, `exports`, or dependency wiring in this package's `package.json`, run a workspace install so Yarn refreshes the linked binary metadata:

```bash
yarn install --mode=skip-build
```

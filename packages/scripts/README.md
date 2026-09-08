# AI Crew Suite Vitest Config

This plugin provides monorepo scripts used by the AI Crew Suite.

## Consuming this package

```json
{
  "scripts": {
    "sync": "yarn workspace @ai-crew-suite/scripts run run:sync-refs"
  }
}
```

## Development notes

This is a TypeScript package. Source files live under `src`, and the build emits runnable JavaScript into `dist`.

## Local workflow

Useful commands while developing on this package:

```bash
yarn turbo run build --filter=@ai-crew-suite/scripts
yarn turbo run lint --filter=@ai-crew-suite/scripts
yarn turbo run test:unit --filter=@ai-crew-suite/scripts
yarn turbo run typecheck --filter=@ai-crew-suite/scripts
```

To run units in a consumer package against the shared config, run its `test:unit` target through Turbo. Example:

```bash
yarn turbo run test:unit --filter=@ai-crew-suite/<my-package>
```

If you change `bin`, `exports`, or dependency wiring in this package's `package.json`, run a workspace install so Yarn refreshes the linked binary metadata:

```bash
yarn install --mode=skip-build
```

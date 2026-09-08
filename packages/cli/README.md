# AI Crew Suite Typecheck Utility

This plugin exists to provide a centralized typecheck tool so it can be developed without updating the "typecheck" script across all monorepo packages.

## Consuming this package

Use the package-provided wrapper in the consumer package's `package.json`:

```json
{
  "scripts": {
    "typecheck": "ai-crew-suite-typecheck
  }
}
```

## Development notes

This is a TypeScript package. Source files live under `src`, and the build emits runnable JavaScript into `dist`. Since the `packages` directory is configured as a workspace in the root `package.json`, Yarn will automatically symlink the `dist` folder into the root `node_modules` file, and do the same with the `bin` key in this package's `package.json` file.

## Local workflow

Useful commands while developing on this package:

```bash
yarn turbo run build --filter=@ai-crew-suite/typecheck
yarn turbo run lint --filter=@ai-crew-suite/typecheck
yarn turbo run test:unit --filter=@ai-crew-suite/typecheck
yarn turbo run typecheck --filter=@ai-crew-suite/typecheck
```

To validate a consumer package against the shared config, run its typecheck target through Turbo. Example:

```bash
yarn turbo run typecheck --filter=@ai-crew-suite/<my-package>
```

If you change `bin`, `exports`, or dependency wiring in this package's `package.json`, run a workspace install so Yarn refreshes the linked binary metadata:

```bash
yarn install --mode=skip-build
```

## ESLint

Supported canonical `--role` values:

- `node-library`:   Use for server-side libraries, config packages, utility packages, and anything Node-only. Has alias `node`.
- `web-library`:   Use for browser/UI libraries that are not full Backstage plugins. Has alias `web`.
- `backend`:  Use for a backend app/package.
- `backend-plugin`:   Use for Backstage backend plugins.
- `backend-plugin-module`:   Use for backend plugin modules/extensions.
- `frontend`:   Use for a frontend app/package.
- `frontend-plugin`:   Use for Backstage frontend plugins.
- `frontend-plugin-module`:   Use for frontend plugin modules/extensions.
- `cli`:   Use for command-line packages.
- `cli-module`:   Use for CLI extension/module packages.
- `common-library`:   This exists, but I would not use it yet. In the current implementation it does not get the frontend/browser branch you’d probably expect, so it behaves like base TS-only config unless you fix that in `index.ts`.

One special case remains for `packages/config-eslint/package.json`, because a package cannot reliably invoke its own workspace bin by name in its own script environment:

`"lint": "node ./bin/ai-crew-eslint.mjs --role node-library src --max-warnings 0"`

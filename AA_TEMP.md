- **`-backend`** (Main Plugin)

  - **Use case:** The primary entry point for a backend plugin that establishes the router, sets up dependencies, and creates extension points.

  - **Pattern:** `<scope>/plugin-<pluginId>-backend`

  - **Example:** `@ai-crew-suite/plugin-tool-observability-backend`

  

- **`-backend-module-<moduleId>`** (Plugin Extension)

  - **Use case:** An extension module that injects a feature, processor, or driver directly into an extension point exposed by a `-backend` plugin.
  - **Pattern:** `<scope>/plugin-<pluginId>-backend-module-<moduleId>`
  - **Example:** `@ai-crew-suite/plugin-tool-observability-backend-module-datadog`

  

- **`-node`** (Shared Backend Library)

  - **Use case:** A library package that houses shared TypeScript definitions, extension points, or common utilities meant to be consumed by other backend plugins or backend modules.
  - **Pattern:** `<scope>/plugin-<pluginId>-node`
  - **Example:** `@ai-crew-suite/plugin-core-node`

  

- **`(no suffix)`** (Main Frontend Plugin)

  - **Use case:** The principal frontend package that contains components, pages, extensions, and the UI wrapper. By convention, Backstage does **not** suffix frontend plugins with `-frontend`.
  - **Pattern:** `<scope>/plugin-<pluginId>`
  - **Example:** `@ai-crew-suite/plugin-agent-alert-tuner`

  

- **`-react`** (Shared Frontend Library)

  - **Use case:** Exposes shared React components, hooks, contexts, or frontend API references to other frontend plugins.
  - **Pattern:** `<scope>/plugin-<pluginId>-react`
  - **Example:** `@ai-crew-suite/plugin-agent-core-react`

  

- **`-common`** (Isomorphic / Shared Code)

  - **Use case:** Holds shared code (like Zod schemas, TypeScript types, data interfaces, or utils) that needs to be imported by **both** the backend and frontend packages.
  - **Pattern:** `<scope>/plugin-<pluginId>-common`
  - **Example:** `@ai-crew-suite/plugin-tool-observability-common`

### 
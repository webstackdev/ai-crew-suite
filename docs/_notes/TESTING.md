# Testing for AI Plugins

## Tooling

### Request Drivers

These tools act as the client. They execute HTTP requests directly against your API platform and run assertions on the responses.

#### Postman

- **What it is:** A feature-rich visual GUI application used to design, build, manually test, and debug APIs.
- **How it works:** You create "Collections" of API requests. Inside each request, you can write JavaScript snippets in the "Scripts" tab to store response tokens as variables and execute basic assertions (e.g., `pm.response.to.have.status(200)`).
- **Best use case:** Exploratory testing, building quick interactive documentation, and collaboration between product managers, QA testers, and developers.

#### Newman

- **What it is:** Postman's official, open-source command-line tool designed to run Postman collections natively in code environments.
- **How it works:** You export your Postman Collection and Environment settings as JSON files from the desktop app. You then pass these files to Newman in your terminal (`newman run collection.json`). It executes every request in sequence and outputs a testing report.
- **Best use case:** Automating your existing Postman collections directly into a CI/CD pipeline (like GitHub Actions or Jenkins) without touching a GUI.

### Backstage Core Test Orchestrator

`startTestBackend` is the the core test orchestrator. It allows you to initialize a lightweight, sandboxed version of the actual Backstage backend engine inside a Jest or Vitest test suite. You pass it your plugin and any mocked dependencies, and it boots up an in-memory HTTP server.

You can hit your plugin's actual HTTP endpoints using a test client (like `supertest`) to perform deep integration testing of your backend logic without running a separate Node process or Docker container.

## Testing Code Organization

### Localized tests (inside the plugin folder)

Keep files like `router.test.ts` right next to the code under test. This ensures standard Yarn/Lerna boundary isolation works smoothly when executing commands like `yarn test` specifically inside your custom plugin folder.

### Shared `test-fixtures` workspace (top-level `packages/`)

Do not duplicate data definitions if multiple plugins depend on identical structural signatures (like a specific AWS resource format). Export these profiles out of a dedicated local utility module (e.g., `@internal/test-fixtures`) and declare it inside the `devDependencies` of your individual plugins.

```bash
ai-crew-suite/
├── packages/
│   └── backend/  # Main Backstage engine deployment
├── plugins/
│   └── agentic-workflow/  # Your custom code
│       └── src/
│           ├── service/
│           │   └── router.test.ts # LOCALIZED test files
│           └── testUtils/  # Shared internals for THIS plugin
└── packages/
    └── test-fixtures/  # GLOBAL shared monorepo testing workspace
        ├── package.json
        └── src/
            ├── catalogEntities.ts # Pre-baked K8s / Datadog catalog templates
            └── mockFactories.ts  # Reusable custom Service factories
```

## Mocking Strategy

### Mocking the Backstage Catalog

This approach focuses strictly on **Catalog Entities** (`Component`, `System`, `API`, `Resource`). Backstage is an entity-centric platform; many plugins use the Catalog as the "source of truth" to know what services exist, who owns them, and what annotations they have (e.g., `://github.com` or `backstage.io/kubernetes-id`).

- **How it works**: You supply a static array of mock YAML/JSON Backstage entities to a test catalog instance.
- **When to use it**: When your agentic workflow needs to scan the software ecosystem, find specific types of services, inspect relationships (e.g., "Find all components owned by Team X"), or look up metadata annotations required to fetch external metrics.
- **Limitation**: It only mocks the metadata catalog. It does _not_ simulate dynamic, live data API calls like pulling GitHub Actions run statuses or Datadog active alert graphs.

### Mocking Core Backend Service Factories

This approach focuses on **Core Backend Services**. In Backstage's modern backend system, everything—from logging and database access to token authentication and HTTP routing—is injected as a "Service". Plugins interact with each other by requesting these services.

- **How it works**: You implement a mock version of a TypeScript interface for a specific Backstage service and register it with the test backend environment.
- **When to use it**: When your agentic plugin needs to interact with core Backstage infrastructure. For example, mocking the `HttpAuthService` to simulate different user permissions, or mocking the `SchedulerService` to test how your agent reacts when an asynchronous task triggers.
- **The Difference**: Mocking the catalog gives you control over what data exists in the ecosystem registry. Mocking a service factory gives you control over how the Backstage backend behaves and authenticates.

The framework provides pre-built, production-ready mocks for almost every core Backstage system service out of the box, saving you from writing stub classes using the `mockServices` export of `@backstage/backend-test-utils`:

- **`mockServices.auth()` & `mockServices.httpAuth()`**: Mocks the complex Backstage identity token validation. You can issue dummy tokens to test user-specific agent workflows or administrative bypasses.
- **`mockServices.cache`**: Key-value data cache management.
- **`mockServices.database()`**: Automatically provisions an in-memory SQLite database instance for your plugin. When your test finishes, the database is wiped. This lets you test stateful agent workflows (like tracking an active multi-step autonomous task) without needing a local PostgreSQL instance.
- **`mockServices.discovery`**: Resolves local URL pathways for inter-plugin API communication.
- **`mockServices.httpRouter`**: Handles endpoint registrations.
- **`mockServices.lifecycle` / `rootLifecycle`**: Hooks for application boot and shutdown cycles.
- **`mockServices.permissions`**: Overrides role authorization blocks (`ALLOW`/`DENY`).
- **`mockServices.rootConfig()`**: Allows you to pass a custom JavaScript object representing your `app-config.yaml` to the runtime, making it incredibly easy to test how your plugin handles different configuration variations or feature flags.
- **`mockServices.rootLogger()`**: Suppresses noisy log outputs during testing while still allowing you to assert that specific errors or warnings were logged by your agent.
- **`mockServices.scheduler`**: Triggers recurring Cron/background tasks immediately without real delays.
- **`mockServices.urlReader`**: Simulates reading files from remote repositories like GitHub or GitLab.

### Service Registry Customization for Internal Plugins

If your agentic plugin needs to call a custom backend API exposed by _another_ proprietary plugin in your monorepo, you can use the `ServiceRegistry` utilities to define and inject your own custom service interfaces.

### Mocking Data From Third-Party Plugins

Because you are building a custom plugin that relies on data exposed by other plugins, you must avoid trying to mimic raw external platforms. Instead, mock the data structures _after_ those plugins have translated them.

#### Mocking Kubernetes data

The Backstage Kubernetes plugin maps container states directly into the core catalog using annotations. It matches software assets via a `backstage.io/kubernetes-id` marker.

**The Mock Strategy**: Use `catalogServiceMock` to seed your test harness with entities containing these specific annotations.

If your agent bypasses the Catalog and talks straight to the `KubernetesBuilder` backend surface, write a TypeScript mock matching the internal `KubernetesClientProvider` layout, returning static arrays of mock pods.

#### Mocking GitHub data

If your workflows are reading files, use `mockServices.urlReader.factory()`. The `urlReader` service is the native tool Backstage plugins use to grab files across different git providers.

```typescript
import { mockServices } from '@backstage/backend-test-utils';

const urlReaderMock = mockServices.urlReader.factory({
  extraReaders: [
    {
      // Intercept any request pointed at GitHub
      canRead: url => url.host === 'github.com',
      read: async () => Buffer.from(JSON.stringify({ status: 'success' })),
      readUrl: async () => ({
        buffer: async () => Buffer.from('file-content'),
      }),
    },
  ],
});
```

#### Mocking Datadog / AWS metrics data

Most deep observability plugins expose specialized **TypeScript Service Interfaces** to pass analytical information across internal plugins.

**The Mock Strategy**: Find the core service reference exported by the plugin (e.g., `datadogServiceRef`).

Instead of dealing with HTTP layers, define a TypeScript implementation using Backstage's `createServiceFactory` pattern to return your stateful mocked data stream directly to the `startTestBackend` matrix.

```typescript
import { startTestBackend } from '@backstage/backend-test-utils';
import { datadogServiceRef } from '@backstage/plugin-datadog-node';

const mockDatadogFactory = createServiceFactory({
  service: datadogServiceRef,
  deps: {},
  async factory() {
    return {
      // Direct mock implementation of their internal service client interface
      getMetrics: async (componentName: string) => ({
        alertCount: 0,
        status: 'OK',
      }),
    };
  },
});

const { server } = await startTestBackend({
  features: [
    myAgenticPlugin(),
    mockDatadogFactory(), // Injects your mocked service into the platform
  ],
});
```

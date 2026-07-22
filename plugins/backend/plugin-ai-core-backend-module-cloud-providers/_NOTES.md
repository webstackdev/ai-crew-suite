# Cloud Providers Notes

Planned Agentic Workflow Plugins Consuming Cloud Providers Sibling Plugins

## AWS, Azure, GCS Plugin Consuming Proposed Plugins

The following proposed agentic workflow plugins consume this plugin:

- `scaffolder-ai-drift-detector`: Polled to extract real-time live topology metadata (e.g., active cluster configurations, container resource limits, or unexpected block storage attachments).
- `scaffolder-ai-shadow-detective`: Polled by the _Scout_ node to pull raw cluster, database, and object storage descriptors alongside runtime billing metrics.

## AWS Plugins Available

The official AWS collection splits functionalities into dedicated frontend and backend packages to minimize bundle sizes:

- **Amazon ECS & EKS:** View running ECS tasks, services, and cluster metrics without visiting the AWS Management Console.
- **Amazon ECR:** Embed container images, tags, and vulnerability scanning statuses directly into service catalog tabs.
- **AWS Lambda:** Map specific Lambda functions to their code-owning software entities to track runtimes, versions, and CloudWatch metrics.
- **AWS CodePipeline:** Track real-time execution pipelines, build history, and deploy states.
- **AWS Config Catalog:** Automate infrastructure mapping by dynamically ingesting existing AWS resources into the Backstage catalog using incremental ingestion.
- **AWS Cost Insights:** Use the AWS Cost Explorer API to project software operational costs next to application code (note: queries incur normal API costs).

## Azure Plugins Available

### Azure Catalog & integration plugins

These modules automate the discovery and modeling of your Azure assets inside the software catalog:

- **Azure DevOps Discovery**: Scans Azure DevOps organizations and projects to find and register `catalog-info.yaml` files automatically.
- **Azure Resource Graph**: Queries live Azure cloud resource configurations across subscriptions and ingests them as native Backstage entities.

### Azure Service-specific frontend & backend plugins

These components embed operational UI dashboards, pipelines, and cloud health metrics directly into your Backstage component views:

- **Azure Pipelines**: Embeds your active CI/CD workflows, build logs, status badges, and execution histories into software components.
- **Azure Repos**: Displays active repository information, branch data, and code insights.
- **Azure Artifacts**: Surfaces package management data, version lists, and dependency details.
- **Azure Container Registry (ACR)**: Monitors container images, tags, deployment paths, and security vulnerability profiles.
- **Azure Functions**: Displays infrastructure summaries, health metrics, and serverless logs mapped to the owning team.

### Azure Authentication & identity plugins

- **Azure Microsoft Entra ID Integration**: Configures secure user sign-on, authenticates API calls, and synchronizes your organizational hierarchy (users and teams) directly into the Backstage catalog using the Microsoft Graph API.

## GCS Plugins Available

### Catalog & integration plugins

These modules automate the discovery, scanning, and representation of your Google Cloud resources inside the software catalog:

- **GCP GCS Discovery**: Scans and crawls targeted Google Cloud Storage buckets to find and register `catalog-info.yaml` files automatically.
- **GCP Asset Inventory**: Intersects with Google Cloud Asset Inventory to sync live cloud infrastructure (Compute Engine, Cloud SQL, GCS buckets) directly into Backstage as tracked resource entities.

### Service-specific frontend & backend plugins

These components embed operational UI dashboards, container management insights, and cloud metrics directly into your Backstage catalog views:

- **Google Kubernetes Engine (GKE)**: Provides centralized cluster visibility, namespace monitoring, pod health statuses, and deployment tracking directly on entity pages.
- **Google Cloud Build**: Embeds real-time CI/CD execution status, build steps, logs, and deployment histories into corresponding software components.
- **Google Artifact Registry**: Surfaces container image metadata, tag histories, vulnerability scan results, and package distributions within the portal.
- **Google Cloud Logging & Monitoring**: Feeds Cloud Monitoring metrics and Cloud Logging alerts directly into service dashboards to track error rates and system availability.

### Authentication & identity plugins

- **Google OAuth Provider**: Configures secure user sign-on using Google Workspace accounts or standard Google identities.
- **Google IAM Integration**: Utilizes Workload Identity Federation or Service Account keys via `@backstage/integration-gcp-node` to handle secure backend API proxying without hardcoded secrets.

## `KubernetesBackend` / `KubernetesService`

The following proposed agentic workflow plugins consume this plugin:

- `catalog-ai-insights`: The source for answering _"Why did this service fail its last deployment?"_. The agent needs to examine the pod states, event streams, or deployment objects retrieved by this plugin.
- `kubernetes-ai-responder`: The initial trigger source. The agent pulls pod descriptors, status codes (e.g., `OOMKilled`, `ImagePullBackOff`), and raw stdout/stderr logs.
- `oncall-ai-handover-assistant`: Scanned by the agent to see what deployments, configuration changes, or scaling events occurred during the shift window.
- `scaffolder-ai-drift-detector`: Polled to extract real-time live topology metadata (e.g., active cluster configurations, container resource limits, or unexpected block storage attachments).

## Implementation Plan

Our goal with the `plugin-ai-core-backend-module-cloud-providers` is to make use of the existing cloud provider plugins that end users may already have installed, by making use of the extension points those plugins provide.

There are two of our nineteen proposed plugins we've identified that will consume the cloud provider plugins listed in the "AWS, Azure, GCS Plugin Consuming Proposed Plugins" section. There are an additional four proposed plugins that will consume the Backstage core Kubernes plugin listed in the "`KubernetesBackend` / `KubernetesService`" section.

I've listed the various official AWS plugins that are available in the "AWS Plugins Available" section. Let's start with our implementation of the stub `plugins/backend/plugin-ai-core-backend-module-cloud-providers/src/providers/aws.ts` driver.

In the next section, please add an implementation plan and any notes you may have for the AWS driver in this plugin. Let's discuss and identify open issues, what AWS official plugins might be involved, if they should be installed in this package or elsewhere in the repo, and any other issues you can identify before we begin an implementation plan.

### Your Implementation Plan

#### Summary

The AWS driver in `plugin-ai-core-backend-module-cloud-providers` should make use of existing Backstage platform services and official AWS plugins that end users may already have installed, rather than introducing direct AWS SDK calls for every operation. The driver has four methods to implement: `lookupAccount`, `lookupResource`, `resourceDependencies`, and `kubernetesWorkloads`. Each has a different optimal integration path.

#### Key Findings

**1. No official Backstage AWS plugins are currently installed in this repo.**

The repo has `@backstage/integration-aws-node` (which provides `DefaultAwsCredentialsManager` for credential management) and `@aws-sdk/client-bedrock-runtime` (used by the existing Bedrock embeddings module), but none of the official AWS catalog/insights plugins listed in the notes above are installed. This means the AWS driver implementation needs to decide whether to:

- **Option A**: Add official AWS plugins as dependencies (e.g., `@aws/plugin-*` packages from the AWS Backstage marketplace) and consume their extension points or service refs.
- **Option B**: Use the AWS SDK directly with `DefaultAwsCredentialsManager` from `@backstage/integration-aws-node` for credential resolution.
- **Option C**: Use the Backstage Catalog API to read AWS resources that have already been ingested into the catalog by AWS Config Catalog or AWS Resource Graph plugins, without adding a direct dependency on those plugins.

**Recommendation**: Start with **Option C** for `lookupResource` and `resourceDependencies` (use the Catalog API to find AWS resources already ingested as Backstage entities), and **Option B** for `lookupAccount` (use `DefaultAwsCredentialsManager` + STS `GetCallerIdentity` for account metadata). For `kubernetesWorkloads`, use the Backstage Kubernetes backend plugin's HTTP API via `coreServices.discovery` (see below).

**2. The Kubernetes backend plugin exposes extension points but no service ref.**

The `@backstage/plugin-kubernetes-backend` package (v0.21.6, already installed) exposes extension points for cluster suppliers, fetchers, service locators, auth strategies, and objects providers through `@backstage/plugin-kubernetes-node`. However, it does not expose a `kubernetesApi` service ref that other backend modules can depend on directly.

The Kubernetes backend exposes an HTTP API at `/api/kubernetes/services/:kind/:namespace/:name` that returns `ObjectsByEntityResponse` containing `ClusterObjects[]` with pod, service, deployment, and other resource types. The cloud providers module can call this API via `coreServices.discovery` and `coreServices.auth` to get the Kubernetes backend URL and forward credentials.

**3. The existing `plugin-ai-core-backend-module-aws` is for Bedrock embeddings, not cloud inventory.**

The existing AWS module (`plugin-ai-core-backend-module-aws`) registers `aws.bedrock.retrieval` for RAG retrieval. It is a separate module from `plugin-ai-core-backend-module-cloud-providers` and should not be confused with it. The cloud providers module is for infrastructure inventory, not embeddings.

#### Implementation Plan

##### Phase 1: Account Lookup via AWS STS

**Method**: `lookupAccount`

Use `DefaultAwsCredentialsManager.fromConfig(config)` from `@backstage/integration-aws-node` to resolve credentials, then call `STS.GetCallerIdentity` to get the account ID, ARN, and user/role. This gives us account metadata without requiring any official AWS Backstage plugin.

**Dependencies to add to `plugin-ai-core-backend-module-cloud-providers`**:

- `@backstage/integration-aws-node` (already in the yarn cache, just needs to be declared)
- `@aws-sdk/client-sts` (already in the yarn cache as a transitive dependency)

**Config additions**:

```yaml
ai:
  integrations:
    cloudProviders:
      defaultProvider: aws
      aws:
        region: us-east-1
        accountId: '012345678901' # optional, for multi-account setups
```

**Open issue**: `DefaultAwsCredentialsManager` is a static factory, not a Backstage service. The module will need to construct it from `coreServices.rootConfig` during init. This is acceptable but means the credential manager is not shared with other modules unless we introduce a service ref for it.

##### Phase 2: Resource Lookup via Catalog API

**Method**: `lookupResource`

Use the Backstage Catalog API (via `CatalogClient` with `coreServices.discovery` and `coreServices.auth`) to find catalog entities that represent AWS resources. This approach works when end users have installed AWS Config Catalog or AWS Resource Graph plugins that ingest AWS resources into the catalog as `Resource` entities with AWS-specific annotations.

**Query strategy**: Filter catalog entities by:

- `kind: Resource`
- `spec.type` matching AWS service types (e.g., `aws-ecs-service`, `aws-lambda-function`, `aws-s3-bucket`)
- `metadata.annotations` containing AWS ARNs or account IDs
- `metadata.tags` matching the caller's tag filter
- `spec.owner` matching the caller's owner filter

**No new dependencies needed**: `@backstage/catalog-client` is already used by the existing AWS Bedrock module and can be added to this module.

**Open issue**: This approach only returns resources that have been ingested into the catalog. If the end user has not installed an AWS catalog ingestion plugin, `lookupResource` will return empty results. We should document this dependency clearly and consider a fallback that uses AWS Resource Explorer or Resource Groups Tagging API directly in a future phase.

##### Phase 3: Resource Dependencies via Catalog Relations

**Method**: `resourceDependencies`

Use the Catalog API to read `relations` on the resource entity. Backstage catalog entities can have `dependsOn` and `dependencyOf` relations that map to cloud dependencies. This approach leverages existing catalog relation semantics without requiring direct AWS API calls.

**Open issue**: Catalog relations are only as good as the ingestion pipeline that creates them. If the AWS Config Catalog plugin does not create dependency relations, this method will return empty dependency lists. A future phase could use AWS Resource Groups or CloudFormation stack outputs to infer dependencies.

##### Phase 4: Kubernetes Workloads via Kubernetes Backend HTTP API

**Method**: `kubernetesWorkloads`

Call the Kubernetes backend's HTTP API via `coreServices.discovery` to resolve the backend URL, then make an authenticated POST request to `/services/:kind/:namespace/:name` with the entity reference. This returns `ObjectsByEntityResponse` containing `ClusterObjects[]` with pods, services, deployments, etc.

**Implementation approach**:

1. Use `coreServices.discovery` to get the Kubernetes backend URL: `discovery.getBaseUrl('kubernetes')`
2. Use `coreServices.auth` to get credentials for the forwarded request
3. POST to `${kubernetesBaseUrl}/services/${kind}/${namespace}/${name}` with body `{ entity: { kind, namespace, name } }`
4. Normalize the response into `KubernetesWorkloadSummary[]` with name, kind, namespace, replicas, status, and images

**Dependencies to add**:

- `@backstage/plugin-kubernetes-common` (for request/response types)

**Open issue**: The Kubernetes backend HTTP API requires entity coordinates (kind, namespace, name), not a catalog entity ref. The driver will need to parse the entity ref or accept entity coordinates directly. We should update the `kubernetesWorkloads` input type to accept either `catalogEntityRef` or explicit `kind`/`namespace`/`name`.

**Open issue**: The Kubernetes backend API is designed for frontend-to-backend calls with user credentials. For agent-initiated calls, we need to use `coreServices.auth` to get service credentials or impersonate the run's identity. This needs to be validated against the Kubernetes backend's auth expectations.

#### Where to Install Official AWS Plugins

Official AWS plugins (ECS, EKS, ECR, Lambda, CodePipeline, Config Catalog, Cost Insights) should **not** be installed as dependencies of `plugin-ai-core-backend-module-cloud-providers`. Instead:

1. **End users install them in their backend** (`packages/backend`) as they would any other Backstage plugin.
2. **The cloud providers module reads from the Catalog** to find resources those plugins have ingested, without a direct dependency.
3. **The module documents which AWS plugins it can leverage** so end users know what to install for full functionality.

This keeps the cloud providers module lightweight and avoids forcing all users to install every AWS plugin. The module degrades gracefully: if no AWS catalog ingestion plugin is installed, `lookupResource` returns empty results rather than failing.

The one exception is `@backstage/integration-aws-node`, which should be a direct dependency because it provides the credential manager that `lookupAccount` needs.

#### Open Issues to Discuss

1. **Multi-account support**: `DefaultAwsCredentialsManager` supports multi-account setups via `aws.accounts` config. Should the driver accept an optional `accountId` in `lookupAccount` to support multi-account queries, or should it always use the default account?

2. **Kubernetes auth model**: The Kubernetes backend API expects user credentials for per-entity queries. For agent-initiated calls, should we use service credentials, the run's identity, or a dedicated service-to-service auth pattern? This needs validation.

3. **Resource normalization**: Different AWS catalog ingestion plugins may use different `spec.type` values and annotations. Should we define a canonical mapping (e.g., `aws-ecs-service` → ECS, `aws-lambda-function` → Lambda) or let the driver pass through whatever the catalog contains?

4. **Cost estimation boundary**: The notes mention AWS Cost Insights as an available plugin. Cost estimation currently lives in the compliance module (`compliance.cost.estimate`). Should the cloud providers module also expose a cost lookup tool, or should the compliance module's cost tool call the cloud providers module for resource context? The plan in `_THIRD_PARTY_PLUGINS.md` says to start cost estimation in compliance and move it to cloud providers only if it becomes provider-resource analysis.

5. **Caching**: AWS API calls (STS, Resource Explorer) and catalog queries can be slow. Should the driver cache results with a TTL, or should caching be handled at the tool level?

6. **Error handling**: When AWS credentials are not configured or the Kubernetes backend is not installed, the driver should return empty results with a warning log rather than throwing. This allows agents to degrade gracefully when optional integrations are not configured.

#### Proposed File Changes

```
plugins/backend/plugin-ai-core-backend-module-cloud-providers/
  package.json                          # Add @backstage/integration-aws-node, @backstage/catalog-client, @aws-sdk/client-sts, @backstage/plugin-kubernetes-common
  src/providers/aws.ts                  # Implement real driver
  src/providers/kubernetes.ts           # New: Kubernetes HTTP API client
  src/providers/types.ts                # Update kubernetesWorkloads input type
  src/module.ts                         # Wire CatalogClient, discovery, auth into driver
  config.d.ts                           # Add accountId config field
  src/__tests__/aws.test.ts             # New: AWS driver tests
  src/providers/__tests__/kubernetes.test.ts  # New: Kubernetes client tests
```

### Analysis for Azure and GCS

#### Azure Driver Analysis

##### Summary

The Azure driver follows the same architectural pattern as the AWS driver: use the Catalog API for resource lookup and dependencies, use provider-native credential resolution for account metadata, and use the Kubernetes backend HTTP API for workload inspection. The key differences from AWS are in credential management, catalog ingestion plugins, and the lack of a Backstage integration package equivalent to `@backstage/integration-aws-node`.

##### Key Differences from AWS

**1. No Backstage integration package for Azure credentials.**

Unlike AWS, which has `@backstage/integration-aws-node` providing `DefaultAwsCredentialsManager`, there is no `@backstage/integration-azure-node` package in the repo or the yarn cache. Azure credential resolution must use the `@azure/identity` SDK directly.

The `@azure/identity` package (v4.13.1, already in the yarn cache as a transitive dependency of the Kubernetes backend) provides:

- `DefaultAzureCredential` - A chained credential that tries multiple auth methods (environment variables, managed identity, Visual Studio Code, CLI, etc.)
- `ClientSecretCredential` - For service principal auth with tenant ID, client ID, and client secret
- `ManagedIdentityCredential` - For Azure Managed Identity (system-assigned or user-assigned)

**Recommendation**: Use `DefaultAzureCredential` from `@azure/identity` for `lookupAccount`. This follows the same environment-variable-first pattern as AWS but uses Azure's native credential chain. The Kubernetes backend already depends on `@azure/identity` for its `AzureIdentityStrategy`, so this dependency is transitively available.

**2. Azure Resource Graph is the primary catalog ingestion plugin.**

The Azure Resource Graph plugin queries live Azure resource configurations across subscriptions and ingests them as native Backstage entities. This is the Azure equivalent of AWS Config Catalog. The `lookupResource` method should query the Catalog API for `Resource` entities with Azure-specific annotations and `spec.type` values.

Azure DevOps Discovery is a separate concern (source control, not cloud infrastructure) and is handled by the VCS module, not the cloud providers module.

**3. Azure subscription is the account boundary.**

AWS uses account IDs as the primary account boundary. Azure uses subscriptions as the primary boundary, with management groups as a higher-level grouping. The `lookupAccount` method should return subscription metadata (subscription ID, display name, tenant ID) rather than a single "account" concept.

**Config additions for Azure**:

```yaml
ai:
  integrations:
    cloudProviders:
      defaultProvider: azure
      azure:
        subscriptionId: '00000000-0000-0000-0000-000000000000'
        tenantId: '00000000-0000-0000-0000-000000000000'
```

**4. Kubernetes auth for AKS clusters.**

The Kubernetes backend already includes `AksStrategy` and `AzureIdentityStrategy` for authenticating to AKS clusters. The `kubernetesWorkloads` method uses the same Kubernetes backend HTTP API regardless of cloud provider, so no Azure-specific Kubernetes code is needed in the cloud providers module. The Kubernetes backend handles AKS auth through its own auth strategy configuration.

##### Azure Implementation Plan

- **`lookupAccount`**: Use `DefaultAzureCredential` + Azure ARM API (`/subscriptions/{subscriptionId}`) to get subscription metadata. Map to `CloudAccountSummary` with `id` = subscription ID, `name` = display name, `provider` = `azure`, `metadata.tenantId` = tenant ID.
- **`lookupResource`**: Use Catalog API to find `Resource` entities ingested by Azure Resource Graph. Filter by `spec.type` matching Azure resource types (e.g., `azure-virtual-machine`, `azure-storage-account`, `azure-sql-database`).
- **`resourceDependencies`**: Use Catalog API relations, same as AWS.
- **`kubernetesWorkloads`**: Use Kubernetes backend HTTP API, same as AWS. AKS auth is handled by the Kubernetes backend's `AksStrategy`.

##### Azure Open Issues

1. **No `@backstage/integration-azure-node`**: Unlike AWS, there is no Backstage integration package for Azure. The driver must construct `DefaultAzureCredential` directly. This means Azure credential config (tenant ID, subscription ID, client ID/secret) must be read from `ai.integrations.cloudProviders.azure` config rather than a shared `azure` config namespace.

2. **Multi-subscription support**: Azure organizations often have many subscriptions. Should `lookupAccount` accept an optional `subscriptionId`, or should it always use the configured default subscription? The `lookupResource` method should probably search across all subscriptions that have been ingested into the catalog.

3. **Azure Resource Graph query fallback**: If the Azure Resource Graph plugin is not installed, should the driver fall back to direct Azure Resource Graph API queries? This would require `@azure/arm-resourcegraph` as a dependency.

4. **Managed Identity vs Service Principal**: In production Backstage deployments running on Azure infrastructure, Managed Identity is preferred. In local development or non-Azure deployments, Service Principal credentials are needed. The driver should support both through `DefaultAzureCredential`'s automatic chaining.

---

#### GCS (Google Cloud) Driver Analysis

##### Summary

The GCS driver follows the same pattern as AWS and Azure. The key differences are in credential management (Google Auth Library instead of AWS SDK or Azure Identity), catalog ingestion plugins (GCP Asset Inventory instead of AWS Config Catalog or Azure Resource Graph), and the GKE Kubernetes integration.

##### Key Differences from AWS

**1. No Backstage integration package for GCP credentials.**

There is no `@backstage/integration-gcp-node` package in the repo or yarn cache. The notes mention it as available (`@backstage/integration-gcp-node` for Workload Identity Federation or Service Account keys), but it is not currently installed.

The `google-auth-library` package (v9.15.1, already in the yarn cache) provides:

- `GoogleAuth` - The main auth class that supports multiple credential types
- Application Default Credentials (ADC) - Falls back to `GOOGLE_APPLICATION_CREDENTIALS` env var or metadata server
- Service Account auth - From JSON key file
- Workload Identity Federation - For running outside GCP

**Recommendation**: Use `GoogleAuth` from `google-auth-library` for `lookupAccount`. This follows the same environment-variable-first pattern as AWS and Azure. If `@backstage/integration-gcp-node` becomes available in the future, switch to it for consistency with the Backstage ecosystem.

**2. GCP Asset Inventory is the primary catalog ingestion plugin.**

GCP Asset Inventory intersects with Google Cloud Asset Inventory to sync live cloud infrastructure (Compute Engine, Cloud SQL, GCS buckets) directly into Backstage as tracked resource entities. This is the GCP equivalent of AWS Config Catalog and Azure Resource Graph.

GCP GCS Discovery is a narrower plugin that only scans Cloud Storage buckets for `catalog-info.yaml` files. It is a source control concern, not a cloud inventory concern, and is handled by the VCS module.

**3. GCP project is the account boundary.**

GCP uses projects as the primary resource boundary, with folders and organizations as higher-level groupings. The `lookupAccount` method should return project metadata (project ID, project number, display name) rather than a single "account" concept.

**Config additions for GCP**:

```yaml
ai:
  integrations:
    cloudProviders:
      defaultProvider: gcp
      gcp:
        projectId: my-project-id
```

**4. Kubernetes auth for GKE clusters.**

The Kubernetes backend already includes `GoogleStrategy` and `GoogleServiceAccountStrategy` for authenticating to GKE clusters. The `kubernetesWorkloads` method uses the same Kubernetes backend HTTP API regardless of cloud provider, so no GCP-specific Kubernetes code is needed in the cloud providers module. The Kubernetes backend handles GKE auth through its own auth strategy configuration.

##### GCP Implementation Plan

- **`lookupAccount`**: Use `GoogleAuth` from `google-auth-library` + Cloud Resource Manager API to get project metadata. Map to `CloudAccountSummary` with `id` = project ID, `name` = project name, `provider` = `gcp`, `metadata.projectNumber` = numeric project number.
- **`lookupResource`**: Use Catalog API to find `Resource` entities ingested by GCP Asset Inventory. Filter by `spec.type` matching GCP resource types (e.g., `gcp-compute-instance`, `gcp-cloud-sql-instance`, `gcp-storage-bucket`).
- **`resourceDependencies`**: Use Catalog API relations, same as AWS and Azure.
- **`kubernetesWorkloads`**: Use Kubernetes backend HTTP API, same as AWS and Azure. GKE auth is handled by the Kubernetes backend's `GoogleStrategy`.

##### GCP Open Issues

1. **No `@backstage/integration-gcp-node`**: The notes mention this package for Workload Identity Federation, but it is not installed. The driver must use `google-auth-library` directly. If `@backstage/integration-gcp-node` becomes available, switch to it for Backstage-native credential config.

2. **Workload Identity Federation**: For Backstage deployments running outside GCP, Workload Identity Federation is the recommended auth pattern. This requires additional config (workload identity pool, provider, service account impersonation). Should the driver support this in the first pass, or defer to a future phase?

3. **Multi-project support**: GCP organizations often have many projects. Should `lookupAccount` accept an optional `projectId`, or should it always use the configured default project? The `lookupResource` method should search across all projects that have been ingested into the catalog.

4. **GCP Asset Inventory query fallback**: If the GCP Asset Inventory plugin is not installed, should the driver fall back to direct Cloud Asset Inventory API queries? This would require `@google-cloud/asset` as a dependency.

---

#### Cross-Provider Patterns

##### Shared Kubernetes Workloads Implementation

All three providers (AWS, Azure, GCP) use the same Kubernetes backend HTTP API for `kubernetesWorkloads`. The Kubernetes backend handles provider-specific auth through its auth strategies:

| Provider | Kubernetes auth strategy                         | Config namespace                   |
| -------- | ------------------------------------------------ | ---------------------------------- |
| AWS      | `AwsIamStrategy`                                 | `kubernetes.auth.providers.aws`    |
| Azure    | `AksStrategy`, `AzureIdentityStrategy`           | `kubernetes.auth.providers.azure`  |
| GCP      | `GoogleStrategy`, `GoogleServiceAccountStrategy` | `kubernetes.auth.providers.google` |

This means the `kubernetesWorkloads` implementation is provider-neutral. The same `kubernetes.ts` client file can be shared across all three drivers. The only provider-specific aspect is which clusters are configured, and that is handled by the Kubernetes backend's cluster supplier configuration, not by the cloud providers module.

##### Shared Catalog API Approach

All three providers use the same Catalog API approach for `lookupResource` and `resourceDependencies`. The only difference is the `spec.type` values and annotations to filter on:

| Provider | Catalog ingestion plugin | Example `spec.type` values                                             | Example annotations     |
| -------- | ------------------------ | ---------------------------------------------------------------------- | ----------------------- |
| AWS      | AWS Config Catalog       | `aws-ecs-service`, `aws-lambda-function`, `aws-s3-bucket`              | `amazonaws.com/arn`     |
| Azure    | Azure Resource Graph     | `azure-virtual-machine`, `azure-storage-account`, `azure-sql-database` | `azure.com/resource-id` |
| GCP      | GCP Asset Inventory      | `gcp-compute-instance`, `gcp-cloud-sql-instance`, `gcp-storage-bucket` | `gcp.com/project-id`    |

The `lookupResource` implementation can be shared across providers with a provider-specific filter mapping. The `resourceDependencies` implementation is identical across providers since it reads catalog relations.

##### Credential Management Differences

| Provider | Credential package                | Primary credential type        | Config namespace                                           |
| -------- | --------------------------------- | ------------------------------ | ---------------------------------------------------------- |
| AWS      | `@backstage/integration-aws-node` | `DefaultAwsCredentialsManager` | `aws.*` (shared)                                           |
| Azure    | `@azure/identity`                 | `DefaultAzureCredential`       | `ai.integrations.cloudProviders.azure.*` (module-specific) |
| GCP      | `google-auth-library`             | `GoogleAuth` (ADC)             | `ai.integrations.cloudProviders.gcp.*` (module-specific)   |

AWS is the only provider with a Backstage integration package for credentials. Azure and GCP require direct SDK usage. This is an inconsistency that could be addressed by creating `@backstage/integration-azure-node` and `@backstage/integration-gcp-node` packages, but that is outside the scope of this module.

##### Proposed File Changes (Updated)

```
plugins/backend/plugin-ai-core-backend-module-cloud-providers/
  package.json                          # Add @backstage/integration-aws-node, @backstage/catalog-client,
                                        #   @aws-sdk/client-sts, @backstage/plugin-kubernetes-common,
                                        #   @azure/identity, google-auth-library
  src/providers/aws.ts                  # Implement AWS driver
  src/providers/azure.ts                # New: Azure driver
  src/providers/gcp.ts                  # New: GCP driver
  src/providers/kubernetes.ts           # New: Shared Kubernetes HTTP API client
  src/providers/catalog.ts              # New: Shared catalog resource lookup helper
  src/providers/types.ts                # Update kubernetesWorkloads input type
  src/module.ts                         # Wire provider-specific drivers based on config
  config.d.ts                           # Add accountId, subscriptionId, tenantId, projectId fields
  src/__tests__/aws.test.ts             # New: AWS driver tests
  src/__tests__/azure.test.ts           # New: Azure driver tests
  src/__tests__/gcp.test.ts             # New: GCP driver tests
  src/providers/__tests__/kubernetes.test.ts  # New: Kubernetes client tests
  src/providers/__tests__/catalog.test.ts     # New: Catalog lookup helper tests
```

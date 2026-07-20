# @webstackbuilders/plugin-ai-core-backend-module-cloud-providers

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

This package implements the cloud providers integration module for AI Crew Suite. It registers stable, provider-neutral cloud inventory, ownership, and infrastructure context tools with the AI Core backend through Backstage's module system, while hiding vendor-specific API calls behind a `CloudProviderDriver` interface.

### Core Responsibilities

- **Backend module registration**: Registers `aiCoreBackendModuleCloudProviders` as an `ai-core` backend module.
- **Provider driver pattern**: Exposes a `CloudProviderDriver` interface with an AWS driver stub.
- **Stable tool registration**: Registers `cloud.account.lookup`, `cloud.resource.lookup`, `cloud.resource.dependencies`, and `cloud.kubernetes.workloads`.
- **Config validation**: Reads and validates `ai.integrations.cloudProviders` configuration.

---

## Configuration

```yaml
ai:
  integrations:
    cloudProviders:
      defaultProvider: aws
      aws:
        region: us-east-1
```

Supported providers: `aws`, `azure`, `gcp`.

---

## Local Development Workflow

```bash
yarn install --refresh
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-cloud-providers build
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-cloud-providers test
```

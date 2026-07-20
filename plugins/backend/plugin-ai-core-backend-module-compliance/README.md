# @webstackbuilders/backstage-plugin-ai-core-backend-module-compliance

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

This package implements the compliance integration module for AI Crew Suite. It registers stable, provider-neutral policy evaluation, permission check, architecture validation, and cost estimation tools with the AI Core backend through Backstage's module system, while hiding vendor-specific API calls behind a `ComplianceDriver` interface.

### Core Responsibilities

- **Backend module registration**: Registers `aiCoreBackendModuleCompliance` as an `ai-core` backend module.
- **Provider driver pattern**: Exposes a `ComplianceDriver` interface with an OPA driver stub.
- **Stable tool registration**: Registers `compliance.policy.evaluate`, `compliance.permission.check`, `compliance.architecture.validate`, and `compliance.cost.estimate`.
- **Config validation**: Reads and validates `ai.integrations.compliance` configuration.

---

## Configuration

```yaml
ai:
  integrations:
    compliance:
      policy: opa
      opa:
        baseUrl: http://localhost:8181
      staticPolicies:
        path: ./config/ai-policies.yaml
```

Supported policy providers: `opa`, `static`.

---

## Local Development Workflow

```bash
yarn install --refresh
yarn workspace @webstackbuilders/backstage-plugin-ai-core-backend-module-compliance build
yarn workspace @webstackbuilders/backstage-plugin-ai-core-backend-module-compliance test
```

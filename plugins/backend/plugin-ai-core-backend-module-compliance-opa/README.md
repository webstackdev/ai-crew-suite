# @webstackbuilders/plugin-ai-core-backend-module-compliance-opa

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

Registers an Open Policy Agent `ComplianceDriver` with
`@webstackbuilders/plugin-ai-core-backend-module-compliance` through the
`complianceDriversExtensionPoint`. This package owns OPA REST API access and
result normalization; the core module owns the tool surface.

## Configuration

```yaml
ai:
  integrations:
    compliance:
      provider: opa
      opa:
        baseUrl: https://opa.my-org.example
        defaultPolicy: compliance/iac
        permissionPolicy: compliance/permission
        architecturePolicy: compliance/architecture
        costPolicy: compliance/cost
        bearerToken: ${OPA_BEARER_TOKEN}
```

OPA paths may use slash or dot notation. They are normalized to the OPA Data API
path `/v1/data/<policy-path>`. The driver sends the tool payload as the OPA
`input` document and accepts a Boolean decision or an object containing `allow`,
`allowed`, `passed`, `valid`, `violations`, or cost fields.

## Installation

```ts
backend.add(
  loadBackendFeature(
    import('@webstackbuilders/plugin-ai-core-backend-module-compliance-opa'),
  ),
);
```

## Local Development Workflow

```bash
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-compliance-opa build
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-compliance-opa test
```

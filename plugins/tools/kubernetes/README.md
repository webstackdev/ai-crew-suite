# @webstackbuilders/plugin-ai-core-backend-module-kubernetes

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

This package is the **core module for Kubernetes operational diagnostics**. It
owns the normalized workload, pod, log, event, and timeline tool surface. A
Backstage-aware diagnostics driver registers through
`kubernetesDiagnosticsDriversExtensionPoint` and owns catalog correlation,
cluster authentication, authorization, redaction, and bounded API access.

The module intentionally does not create raw Kubernetes clients from root
configuration. That would bypass the Kubernetes backend's cluster supplier,
service locator, and authentication model.

### Stable Tools

- `kubernetes.workload.resolve`
- `kubernetes.workload.get_snapshot`
- `kubernetes.pod.get_snapshot`
- `kubernetes.pod.get_logs`
- `kubernetes.workload.list_events`
- `kubernetes.workload.get_timeline`

All tools are read-only. Drivers must enforce bounded results and redact
sensitive content before returning log excerpts or object metadata.

## Configuration

```yaml
ai:
  integrations:
    kubernetes:
      provider: backstage
```

The selected provider must register a `KubernetesDiagnosticsDriver`. The core
module fails startup when no matching driver has been loaded.

## Local Development Workflow

```bash
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-kubernetes build
yarn workspace @webstackbuilders/plugin-ai-core-backend-module-kubernetes test
```

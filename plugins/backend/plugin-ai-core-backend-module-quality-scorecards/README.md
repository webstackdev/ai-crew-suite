# @webstackbuilders/backstage-plugin-ai-core-backend-module-quality-scorecards

> Core Developer Documentation for the AI Crew Suite platform.

## Overview

This package implements the quality scorecards integration module for AI Crew Suite. It registers stable, provider-neutral service quality, standards, maturity, and readiness tools with the AI Core backend through Backstage's module system, while hiding vendor-specific API calls behind a `QualityScorecardDriver` interface.

### Core Responsibilities

- **Backend module registration**: Registers `aiCoreBackendModuleQualityScorecards` as an `ai-core` backend module.
- **Provider driver pattern**: Exposes a `QualityScorecardDriver` interface with a Soundcheck driver stub.
- **Stable tool registration**: Registers `quality.scorecard.get`, `quality.checks.list`, `quality.tech_radar.lookup`, and `quality.service_profile.get`.
- **Config validation**: Reads and validates `ai.integrations.qualityScorecards` configuration.

---

## Configuration

```yaml
ai:
  integrations:
    qualityScorecards:
      provider: soundcheck
      soundcheck:
        baseUrl: https://soundcheck.example.com
```

Supported providers: `soundcheck`, `scorecards`, `internal`.

---

## Local Development Workflow

```bash
yarn install --refresh
yarn workspace @webstackbuilders/backstage-plugin-ai-core-backend-module-quality-scorecards build
yarn workspace @webstackbuilders/backstage-plugin-ai-core-backend-module-quality-scorecards test
```

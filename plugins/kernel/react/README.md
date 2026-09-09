# @ai-crew-suite/plugin-kernel-react

> Canonical TypeScript Type Definitions and Shared Contract Models for the AI Crew Suite platform.

## Overview

This module isolates the core structural boundaries, payload types, and event primitives that govern stream telemetry across all 18 agent packages within the AI Crew Suite ecosystem.

By centralizing these types inside the `@ai-crew-suite/plugin-core-react` kernel layer, the platform enforces type-safe contracts for all asynchronous stream processors and event-driven React components.

## Architectural Typologies

### 1. Platform Infrastructure Options

The package provides standard options matching Backstage's core layout models for dependency inversion patterns:

* **`BaseAiAgentClientOptions`**: Encapsulates essential platform API definitions (`ConfigApi`, `DiscoveryApi`, `FetchApi`, and `IdentityApi`) to power downstream infrastructure operations.

### 2. Stream Event Contract Specifications

The event topology outlines the discrete states emitted during an agentic execution pipeline. Every payload variant maps explicitly to a structured `type` discriminator literal:

| Discriminator Event Type | Interface | Payload Context |
| :--- | :--- | :--- |
| `step` | `AiStepEvent` | Tracks pipeline steps through chronological graph nodes and execution phases (`enter` / `exit`). |
| `tool_call` | `AiToolCallEvent` | Dispatches the identifier and parameter payload of an active tool invocation. |
| `tool_result` | `AiToolResultEvent` | Encapsulates tool responses, boolean success metrics, and content summaries. |
| `approval_request` | `AiApprovalRequestEvent` | Interrupts processing to request explicit human-in-the-loop authorization with mutation metrics. |
| `artifact` | `AiArtifactEvent` | Delivers generated assets, system reference keys, and access URIs. |
| `done` | `AiDoneEvent` | Signals terminal execution success for an agentic operation loop. |
| `error` | `AiErrorEvent` | Implements error telemetry captures paired with the originating execution instance scope. |

## Utility Types

### `MasterAiRunEvent`

A comprehensive master union encompassing all valid platform stream events. It is primarily consumed by internal stream orchestrators and catch-all platform components.

### `PickAiEvents<T>`

A highly efficient generic extract filter used by individual feature plugins to construct custom event domains from the master platform definition.

```typescript
import { PickAiEvents } from '@ai-crew-suite/plugin-core-react';

// Automatically compiles a focused union type comprising only specified variants
export type ScaffolderGuardrailEvents = PickAiEvents<'step' | 'approval_request' | 'error' | 'done'>;
```

## Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.

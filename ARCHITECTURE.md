# AI Crew Suite — Monorepo Architecture Guide

Welcome to the **AI Crew Suite** monorepo. This project uses a **Turborepo** monorepo workspace structure to manage our agentic workflow plugins, core orchestration services, and tool abstractions. 

This document defines our hard standards for directory layouts, package naming conventions, and architectural boundaries.

## 🏗️ Architectural Foundations

Our monorepo splits code into three isolated tiers:

1. **Core Orchestration & Infra:** The underlying LangGraph workflow engine, shared Node runtimes, and foundational infrastructure drivers (LLMs, Vector Storage).
2. **Agents:** End-user facing agent workflows, paired cleanly into frontend and backend packages.
3. **Tools:** Standardized interfaces allowing our agents to communicate with third-party software (VCS, Project Management, Slack).

All internal packages belong to the NPM organization scope `@ai-crew-suite`.

## 📁 Repository Directory Structure

```text
ai-crew-suite/
├── apps/                      # Deployable Backstage instances
│   └── backstage/             # Core Backstage runtime application
│
├── plugins/                   # Workspace Packages
│   ├── core/                  # Tier 1: System Orchestration & Runtimes
│   │   ├── backend/           # @ai-crew-suite/core-backend
│   │   ├── node/              # @ai-crew-suite/core-node
│   │   │
│   │   └── infra/             # Foundational engine infrastructure (Registry/Provider pairs)
│   │       ├── llm/
│   │       │   ├── core/      # @ai-crew-suite/infra-llm-core (Registry & Factory Hub)
│   │       │   ├── openai/    # @ai-crew-suite/infra-llm-openai (Pure Driver Supplier)
│   │       │   └── ...        # aws, openrouter
│   │       └── vector/
│   │           ├── core/      # @ai-crew-suite/infra-vector-core
│   │           └── pgvector/  # @ai-crew-suite/infra-vector-pgvector
│   │
│   ├── agents/                # Tier 2: Agentic Workflows (Backend + Frontend pairs)
│   │   ├── core-frontend/     # @ai-crew-suite/agent-core-frontend
│   │   ├── alert-tuner/
│   │   │   ├── backend/       # @ai-crew-suite/agent-alert-tuner-backend
│   │   │   └── frontend/      # @ai-crew-suite/agent-alert-tuner-frontend
│   │   └── scaffolder-prd/
│   │   │   ├── backend/       # @ai-crew-suite/agent-scaffolder-prd-backend
│   │   │   └── frontend/      # @ai-crew-suite/agent-scaffolder-prd-frontend
│   │   └── ...
│   │
│   └── tools/                 # Tier 3: Third-Party Ecosystem Integrations
│       ├── vcs/
│       │   ├── core/          # @ai-crew-suite/tool-vcs-core (Registry & Factory Hub)
│       │   ├── github/        # @ai-crew-suite/tool-vcs-github (Pure Driver Supplier)
│       │   └── gitlab/        # @ai-crew-suite/tool-vcs-gitlab
│       └── project-management/
│       │   ├── core/          # @ai-crew-suite/tool-project-core
│       │   └── jira/          # @ai-crew-suite/tool-project-jira
│       └── ...
```

## 🏷️ Package Naming Conventions

To keep our workspace clean and highly predictable, all package.json names must rigidly follow these prefixes and rules:

### 1. Agents (Workflow Plugins)

Every agent consists of a co-located frontend and backend folder under `plugins/agents/[domain]`.

* **Pattern:** `@ai-crew-suite/agent-[domain]-[purpose]-[backend|frontend]`
* **Rules:** Eliminate any redundant use of ai in the purpose string.
* *Example:* `@ai-crew-suite/agent-alert-tuner-backend`

### 2. Tools & Infrastructure (The Registry/Provider Split)

Both Tools (`plugins/tools/`) and Infrastructure (`plugins/core/infra/`) follow a decoupled **Hub and Spoke** pattern. We explicitly separate the orchestration hub from individual vendor integrations.

#### A. The Registry / Factory Hub (-core)

The parent directory contains a core / folder acting as a driver registry and tool factory coordinator. It exposes the Backstage extension points and compiles tools from configuration.

* **Pattern (Tools):** `@ai-crew-suite/tool-[domain]-core`
* **Pattern (Infra):** `@ai-crew-suite/infra-[domain]-core`
* *Examples:* `@ai-crew-suite/tool-vcs-core`, `@ai-crew-suite/infra-vector-core`

#### B. The Pure Driver Suppliers

Satellite folders represent the standalone vendor plugins. They handle credential resolution, instantiate concrete classes, and register themselves directly to the -core hub's extension point.

* **Pattern (Tools):** `@ai-crew-suite/tool-[domain]-[provider]`
* **Pattern (Infra):** `@ai-crew-suite/infra-[domain]-[provider]`
* *Examples:* `@ai-crew-suite/tool-vcs-github`, `@ai-crew-suite/infra-vector-pgvector`

## 🛑 Architectural Rules

1. **No Circular Dependencies:** `tools` may never depend on `agents`. `infra` may never depend on tools.
2. **Pure Providers:** Satellite driver modules (e.g., `tool-vcs-github`) should strictly register their implementation to their respective hub extension point and side-effect nothing else.
3. **No Root Clutter:** Do not flatten domain integrations into the root of `plugins/tools/`. Keep them neatly grouped inside subdirectories (e.g., `plugins/tools/vcs/*`).

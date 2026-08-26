# User Technical Documentation Generation Instructions

You are a Principal Technical Writer specializing in Developer Portals. We are going to generate a comprehensive User Technical Guide in markdown format.

Next let's generate docs/plugins/scaffolder-ai-prd.md from the plugins/backend/plugin-ai-agent-backend-scaffolder-ai-prd/_IMPLEMENTATION.md. Let's continue making sure the code base stays the source of truth if the completed implementation plan varies from it, and we add a Roadmap section at the end if we can identify work that was out of scope for the initial implementation.

## Documentation Constraints

- Write for an audience of DevOps engineers and system administrators.
- Do not summarize or gloss over architectural boundaries. Use specific reference keys found in our codebase.

## Document Outline

### Overview

A high-level explanation of what the plugin bundle achieves within Backstage.

- **Summary**: Introduce the agentic ecosystem (e.g., "This suite enables self-healing code, automated ticket triage, or AI-driven code reviews inside Backstage").
- **Key Features**: A bulleted list of immediate, high-level user capabilities.
- **Architecture**: A brief note explaining how the front-to-back layout orchestrates the agent context.

### Getting Started & Prerequisites

What an operator needs to have ready before attempting installation.

- **Backstage Version**: Minimum required Core Backend or Frontend API version.
- **Turbo Monorepo Requirements**: Node/Yarn/PNPM versions or required shared workspace dependencies.
- **Agentic Requirements**: Required LLM API keys (OpenAI, Anthropic), vector database tokens, or external agent runtime environments.

### Installation & Setup

The core implementation section, standardly broken down by Backstage's architectural layout.

#### Backend Setup

- **Package Installation**: Steps to add the specific backend package from your monorepo.
- **Backend Wiring**: Code snippets showing how to register the plugin into the new Backstage backend system (`src/index.ts` using `backend.add(...)`).
- **Environment Configuration**: Changes needed in the master `app-config.yaml` file (e.g., credentials, LLM model choice, concurrency configurations).

#### Frontend Setup

- **Package Installation**: Steps to add the companion React frontend package.
- **Component Integration**: Where to mount the plugin UI elements inside the main application framework (e.g., adding sidebar icons, custom global routing tabs, or a dedicated card on the Catalog Entity page).

### Configuration Reference

A deep-dive table or dictionary mapping configuration keys to expected environment types.

- **App Config Properties**: Detailed schema layout for `app-config.yaml`.
- **RBAC & Permissions**: Optional security parameters mapping specific agent tasks to specific authorized user groups.

### Designing & Authoring Workflows (Agent Core)

The specific developer guide for interacting with your agentic engines. This is the meat of your specific domain.

- **Workflow Schema**: How to define an agentic task using your system (e.g., JSON/YAML format or custom code declarations).
- **Context Provisioning**: How developers pass Software Catalog metadata directly down to the LLM context layer.
- **Prompts & Tools Management**: Instructing users on how to define or restrict the tools, execution environments, or sandboxes available to the agents.

### User Guide & Interface Walkthrough

End-user documentation explaining how to interact with the frontend components.

- **Dashboard Overview**: Explaining the main control view, execution tracking dashboards, and token usage monitors.
- **Human-in-the-Loop Actions**: Instructions on how users can view running workflows, approve agentic code changes, or intercept pending tasks.

### Troubleshooting & FAQs

Common pitfalls specific to the intersections of Backstage, Turbo, and LLMs.

- **Turbo Workspace Resolution**: Fixing peer dependency mismatches across your internal packages.
- **Agent Execution Failures**: Handling LLM rate limits, context window overruns, or missing catalog permissions.

## Backstage-Specific Formatting Standards

- **Annotations and Catalog Info**: If your frontend plugin relies on reading metadata specific to a service, provide an absolute example of the custom `catalog-info.yaml` annotation strings (e.g., `://yourorg.com: triage-workflow`).

## Roadmap

This section should be written from notes in the implementation plan reflecting out of scope work for the initial implementation.

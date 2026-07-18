---
plugin_name: techdocs-ai-janitor
category: TechDocs
subcategory: Knowledge
---

# Documentation Janitor

Traditional documentation tools evaluate files in structural isolation. While version control system (**VCS**) platforms handle isolated repository workflows well, they lack an overarching organizational context.

The `techdocs-ai-janitor` is an intelligent, graph-driven plugin for Spotify **Backstage**. By leveraging **LangGraph**, it transitions from static linting to multi-turn, stateful engineering reasoning. Instead of analyzing code files in a vacuum, the plugin utilizes the **Backstage Software Catalog**, **Search Telemetry**, and **TechDocs storage buckets** to autonomously detect architectural drift, heal broken ecosystem links, map shifting team ownership, and proactively resolve documentation gaps across the entire enterprise.

## Features

### **Feature 1:** Cross-Service Architectural Drift Resolution

- **The Problem**: A core infrastructure service updates an internal API schema. Dozens of consumer services have outdated integration guides in their TechDocs.
- **The LangGraph Win**: The graph acts on Catalog lifecycle relationships (`dependsOn`, `providesApi`). When a schema mutation occurs, the node navigates the dependency tree, evaluates the downstream TechDocs files in the storage bucket, rewrites code invocation blocks, and opens automated PRs across all affected repositories.

### **Feature 2:** Intelligent "Intent-Aware" Dead Link Deflection

- **The Problem**: Hardcoded internal links to legacy Confluence paths, retired codebases, or legacy Slack channels rot over time, returning dead links or 404s.
- **The LangGraph Win**: When a link-checker edge in the graph flags a failure, a dedicated **Resolution Agent Node** queries the Backstage global search index and catalog history to infer what the developer _meant_ to link to. If a service was deprecated in favor of a newer system, the agent automatically edits the source Markdown file to reference the active Backstage portal resource.

### **Feature 3:** Demand-Driven Documentation (Telemetry Ingestion)

- **The Problem**: Teams write documentation they _think_ developers need, while actual knowledge gaps go unaddressed.
- **The LangGraph Win**: The plugin acts as a consumer of the **Backstage Search Telemetry API**. If the data shows that developers are repeatedly entering queries like _"how to configure mTLS token rotation"_ and hitting empty results or high bounce rates, the graph initializes. It researches the system configuration, outlines a missing TechDocs section, and assigns an issue or a pre-populated draft PR directly to the owning engineering team.

### **Feature 4:** Governance & Component Metadata Enrichment

- **The Problem**: System ownership (`spec.owner`) shifts frequently during company reorganizations, causing PagerDuty escalation documentation, team names, and communication links within TechDocs files to rapidly go out of date.
- **The LangGraph Win**: The graph matches TechDocs references against live entity metadata inside the Backstage Catalog. It automatically updates point-of-contact details, Slack channel hooks, and support workflows directly in the source Markdown files.

## Nodes & Operational Logic

- **Orchestrator Node**: Evaluates incoming trigger events (such as catalog updates, telemetry data spikes, or a scheduled cron execution) and sets the target state.
- **Researcher Node**: Queries the Backstage Catalog API, parses the downstream dependencies, reads live OpenAPI schemas, and cross-references them with the text stored in the target TechDocs bucket.
- **Writer Node**: Invokes targeted LLMs to perform code-to-text synthesis, rewrites outdated sections, fixes dead URLs, and populates the `proposed_patches` list.
- **Validation Node (The Conditional Edge)**: Runs markdown linters, checks formatting compliance rules, and validates compiled outputs against organizational standards. If compilation checks fail, it loops back to the Writer Node with the failure logs. If they pass, it passes execution to the pull request generation phase.

To implement this plugin, the backend engine defines a unified `JanitorState` schema tracking the target entity, current documentation text, identified discrepancies, and execution validation status.

```typescript
import { StateGraphArgs } from '@langchain/langgraph';
import { Entity } from '@backstage/catalog-model';

/**
 * Represents an architectural discrepancy found within TechDocs.
 */
export interface JanitorDiscrepancy {
  type:
    'architectural_drift' | 'dead_link' | 'stale_ownership' | 'telemetry_gap';
  severity: 'low' | 'medium' | 'high';
  location: string; // Filepath or line reference inside the document
  description: string; // Context for why this is considered a discrepancy
  sourceContext?: any; // Raw data snippet triggering the flag (e.g., failed API schema)
}

/**
 * Represents a single file patch calculated by the LangGraph agent.
 */
export interface DocumentationPatch {
  filePath: string; // Target repo path (e.g., "docs/index.md")
  originalContent: string; // The text block before modifications
  patchedContent: string; // The replacement text block
  explanation: string; // Reason written by the agent for the Pull Request body
}

/**
 * The core, centralized state schema tracking data across the LangGraph tree.
 * Matches the required Type definitions for LangGraph's StateGraph controller.
 */
export interface JanitorState {
  // Target Backstage context
  componentId: string;
  catalogEntity: Entity | null; // Full Backstage Entity definition (spec, owner, etc.)

  // Content extraction track
  targetDocsPath: string;
  rawContent: string;

  // Found anomalies and calculated resolutions
  discrepancies: JanitorDiscrepancy[];
  proposedPatches: DocumentationPatch[];
  validationLogs: string[];

  // Unified memory stream for LangGraph agent communication
  messages: any[];
}

/**
 * LangGraph Channel Configuration definition.
 * Tells the LangGraph engine how to merge state changes when nodes return outputs.
 */
export const janitorStateChannels: StateGraphArgs<JanitorState>['channels'] = {
  componentId: {
    value: (left?: string, right?: string) => right ?? left ?? '',
    default: () => '',
  },
  catalogEntity: {
    value: (left?: Entity | null, right?: Entity | null) =>
      right ?? left ?? null,
    default: () => null,
  },
  targetDocsPath: {
    value: (left?: string, right?: string) => right ?? left ?? '',
    default: () => '',
  },
  rawContent: {
    value: (left?: string, right?: string) => right ?? left ?? '',
    default: () => '',
  },
  // Appends new discrepancies found by the scanner instead of overwriting the array
  discrepancies: {
    value: (left?: JanitorDiscrepancy[], right?: JanitorDiscrepancy[]) =>
      (left ?? []).concat(right ?? []),
    default: () => [],
  },
  // Accumulates patches from different documentation pages
  proposedPatches: {
    value: (left?: DocumentationPatch[], right?: DocumentationPatch[]) =>
      (left ?? []).concat(right ?? []),
    default: () => [],
  },
  // Merges step-by-step compilation or execution logs
  validationLogs: {
    value: (left?: string[], right?: string[]) =>
      (left ?? []).concat(right ?? []),
    default: () => [],
  },
  // Merges user/agent messages sequentially into the communication array
  messages: {
    value: (left?: any[], right?: any[]) => (left ?? []).concat(right ?? []),
    default: () => [],
  },
};
```

/*
 * Copyright 2026 Webstack Builders, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Binds an external trigger source to an agent.
 */
export type TriggerBinding = {
  /** Unique trigger identifier, such as `github-pr-opened` or `nightly-scan`. */
  id: string;
  /** Optional source name associated with the trigger payload. */
  source?: string;
  /** Agent to run when this trigger fires. Required — there is no default-agent fallback. */
  agentId: string;
};

/**
 * Declarative profile for an agent that can be executed by the AI runtime.
 *
 * Every agent is bound to a domain `WorkflowDefinition` via `workflowRef`. There is
 * no built-in orchestrator fallback; an agent without a workflow is a boot-time error.
 */
export type AgentDefinition = {
  /** Unique agent identifier used in API routes, triggers, and run records. */
  id: string;
  /**
   * Model ID from the chat model registry, or a tier name (e.g. `fast`, `reasoning`)
   * resolved to a model ID via the `ai.models.tiers` config.
   */
  modelRef: string;
  /** Required domain workflow definition ID that executes this agent. */
  workflowRef: string;
  /** System prompt applied to the agent's model calls. */
  systemPrompt: string;
  /** Tool IDs the agent is allowed to use. */
  toolIds: string[];
  /** Memory mode for the agent. `session` enables persisted conversational history. */
  memory?: 'none' | 'session';
  /** Optional trigger bindings that can start this agent. */
  triggers?: TriggerBinding[];
  /**
   * Per-category provider allow-list, enforced by the tool executor at dispatch.
   * Absent means any registered provider may be used. Example: `{ communication: ['slack'] }`.
   */
  providers?: Record<string, readonly string[]>;
  /**
   * Per-agent guardrail enforcement. When set, input and/or output text is classified
   * through the registered guardrail model before dispatch/egress.
   */
  guardrails?: { input?: boolean; output?: boolean };
};

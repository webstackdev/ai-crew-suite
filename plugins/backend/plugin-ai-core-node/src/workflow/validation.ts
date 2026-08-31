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

import { END, WorkflowDefinition } from './definition';

/** A single static-validation violation found in a workflow definition. */
export type WorkflowValidationViolation = { message: string };

/**
 * Pure static checks run at boot (or in CI contract tests) on a workflow definition.
 * Returns all violations; the boot path throws when any are present.
 */
export function validateWorkflowDefinition(
  def: WorkflowDefinition<any, any>,
): WorkflowValidationViolation[] {
  const violations: WorkflowValidationViolation[] = [];
  const nodeNames = new Set(Object.keys(def.nodes));

  if (!def.id || def.id.trim().length === 0) {
    violations.push({ message: 'Workflow definition must have a non-empty id' });
  }
  if (!def.inputSchema) {
    violations.push({ message: `Workflow '${def.id}' has no inputSchema` });
  }
  if (!def.state || !def.state.schema) {
    violations.push({ message: `Workflow '${def.id}' has no state schema` });
  }
  if (def.state && typeof def.state.stateVersion !== 'number') {
    violations.push({ message: `Workflow '${def.id}' is missing stateVersion` });
  }
  if (!nodeNames.has(def.entryNode)) {
    violations.push({ message: `Workflow '${def.id}' entryNode '${def.entryNode}' is not a declared node` });
  }

  const declaredKinds = new Set(def.artifactKinds ?? []);

  for (const edge of def.edges) {
    if (!nodeNames.has(edge.from)) {
      violations.push({ message: `Workflow '${def.id}' edge from unknown node '${edge.from}'` });
    }
    if ('to' in edge && !nodeNames.has(edge.to)) {
      violations.push({ message: `Workflow '${def.id}' edge to unknown node '${edge.to}'` });
    }
  }

  for (const interrupt of def.interrupts ?? []) {
    if (!nodeNames.has(interrupt.beforeNode)) {
      violations.push({
        message: `Workflow '${def.id}' interrupt targets missing node '${interrupt.beforeNode}'`,
      });
    }
  }

  // Reject `route` edges whose destination might not exist at call time is checked at runtime;
  // here we only flag empty node maps and empty edge lists.
  if (nodeNames.size === 0) {
    violations.push({ message: `Workflow '${def.id}' declares no nodes` });
  }

  return violations;
}

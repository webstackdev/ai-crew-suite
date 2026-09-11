/*
 * Copyright 2026 The AI Crew Suite Authors
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

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { 
  validateWorkflowDefinition,
  checkMetadata,
  checkGraphNodes,
  checkEdges,
  checkInterrupts,
  checkTopology
} from '../index';
import { END, WorkflowDefinition } from '../../../types/workflow/definition';

const baseDef = (): WorkflowDefinition<{ ok: boolean }, { q: string }> => ({
  id: 'wf',
  inputSchema: z.object({ q: z.string() }),
  state: { schema: z.object({ ok: z.boolean() }), stateVersion: 1 },
  entryNode: 'a',
  nodes: {
    a: async () => ({ ok: true }),
  },
  edges: [{ from: 'a', route: () => END }],
  artifactKinds: [],
});

describe('Workflow Validation Engine', () => {

  describe('Master Pipeline Integration (validateWorkflowDefinition)', () => {
    it('passes a fully compliant, healthy workflow definition with zero errors', () => {
      expect(validateWorkflowDefinition(baseDef())).toEqual([]);
    });

    it('aggregates multiple distinct violations from separate rules simultaneously', () => {
      const def = baseDef();
      def.id = ' '; 
      def.entryNode = 'missing'; 

      const violations = validateWorkflowDefinition(def);
      expect(violations.length).toBeGreaterThanOrEqual(2);
      expect(violations.some(v => v.message.includes('non-empty id'))).toBe(true);
      expect(violations.some(v => v.message.includes('not a declared node'))).toBe(true);
    });
  });

  describe('1. Metadata Evaluation (checkMetadata)', () => {
    it('returns empty array when metadata satisfies entire configuration contract', () => {
      const def = baseDef();
      expect(checkMetadata(def, new Set(['a']), 'wf')).toEqual([]);
    });

    it('flags broken or spaces-only workflow tracking identifiers', () => {
      const def = baseDef();
      def.id = '   ';
      expect(checkMetadata(def, new Set(['a']), '   ')).toEqual([
        { message: 'Workflow definition must have a non-empty id' }
      ]);
    });

    it('flags absent inputSchema boundaries', () => {
      const def = baseDef();
      def.inputSchema = undefined as any;
      expect(checkMetadata(def, new Set(['a']), 'wf')).toEqual([
        { message: "Workflow 'wf' has no inputSchema" }
      ]);
    });

    it('flags completely absent state configuration or schemas', () => {
      const def = baseDef();
      def.state = undefined as any;
      expect(checkMetadata(def, new Set(['a']), 'wf')).toEqual([
        { message: "Workflow 'wf' has no state schema" }
      ]);
    });

    it('flags valid state blocks that omit a numeric version parameter', () => {
      const def = baseDef();
      // @ts-expect-error intentionally invalid
      def.state.stateVersion = 'v1';
      expect(checkMetadata(def, new Set(['a']), 'wf')).toEqual([
        { message: "Workflow 'wf' is missing stateVersion" }
      ]);
    });
  });

  describe('2. Declared Vertices Evaluation (checkGraphNodes)', () => {
    it('returns empty array when entryNode accurately anchors to an existing map element', () => {
      const def = baseDef();
      expect(checkGraphNodes(def, new Set(['a']), 'wf')).toEqual([]);
    });

    it('instantly rejects configurations that map an empty node map', () => {
      const def = baseDef();
      def.nodes = {};
      expect(checkGraphNodes(def, new Set(), 'wf')).toEqual([
        { message: "Workflow 'wf' declares no nodes" }
      ]);
    });

    it('flags entryNode markers referencing unregistered node strings', () => {
      const def = baseDef();
      def.entryNode = 'ghost';
      expect(checkGraphNodes(def, new Set(['a']), 'wf')).toEqual([
        { message: "Workflow 'wf' entryNode 'ghost' is not a declared node" }
      ]);
    });
  });

  describe('3. Edge Connections Evaluation (checkEdges)', () => {
    it('passes clean static and predicate trajectories', () => {
      const def = baseDef();
      expect(checkEdges(def, new Set(['a']), 'wf')).toEqual([]);
    });

    it('passes static transitions explicitly directed straight to the framework END sentinel symbol', () => {
      const def = baseDef();
      def.edges = [{ from: 'a', to: END as any }];
      expect(checkEdges(def, new Set(['a']), 'wf')).toEqual([]);
    });

    it('flags routing origins starting out of an unmapped coordinate space', () => {
      const def = baseDef();
      def.edges = [{ from: 'phantom-origin', to: 'a' }];
      expect(checkEdges(def, new Set(['a']), 'wf')).toEqual([
        { message: "Workflow 'wf' edge from unknown node 'phantom-origin'" }
      ]);
    });

    it('flags explicit destination keys pointing to unknown vertices', () => {
      const def = baseDef();
      def.edges = [{ from: 'a', to: 'unregistered-destination' }];
      expect(checkEdges(def, new Set(['a']), 'wf')).toEqual([
        { message: "Workflow 'wf' edge to unknown node 'unregistered-destination'" }
      ]);
    });
  });

  describe('4. Human-in-the-Loop Interrupt Interceptions (checkInterrupts)', () => {
    it('passes when gates latch onto active structural elements', () => {
      const def = baseDef();
      def.interrupts = [{
        beforeNode: 'a',
        approvalRequest: () => ({ reason: 'auth', effect: 'write' }),
        applyDecision: (s) => s,
      }];
      expect(checkInterrupts(def, new Set(['a']), 'wf')).toEqual([]);
    });

    it('flags parking triggers intercepting nonexistent graph nodes', () => {
      const def = baseDef();
      def.interrupts = [{
        beforeNode: 'missing-step',
        approvalRequest: () => ({ reason: 'auth', effect: 'write' }),
        applyDecision: (s) => s,
      }];
      expect(checkInterrupts(def, new Set(['a']), 'wf')).toEqual([
        { message: "Workflow 'wf' interrupt targets missing node 'missing-step'" }
      ]);
    });
  });

  describe('5. Advanced Topological Graph Traversal (checkTopology)', () => {
    it('passes complex multi-node connected cyclic or acyclic loops with valid terminal boundaries', () => {
      const def = baseDef();
      def.nodes = { a: async () => ({}), b: async () => ({}), c: async () => ({}) };
      def.edges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: END as any },
      ];
      expect(checkTopology(def, new Set(['a', 'b', 'c']), 'wf')).toEqual([]);
    });

    it('flags dead-ends where vertices have zero operational exits to advance tracking', () => {
      const def = baseDef();
      def.nodes = { a: async () => ({}), b: async () => ({}) }; 
      def.edges = [{ from: 'a', to: 'b' }]; 

      expect(checkTopology(def, new Set(['a', 'b']), 'wf')).toEqual([
        { message: "Workflow 'wf' contains a dead-end at node 'b'" }
      ]);
    });

    it('flags unreachable structural orphan sub-graphs detached from the entryNode tree path', () => {
      const def = baseDef();
      def.nodes = { a: async () => ({}), b: async () => ({}), c: async () => ({}) };
      def.edges = [
        { from: 'a', route: () => END },
        { from: 'b', to: 'c' },
        { from: 'c', to: END as any },
      ];

      expect(checkTopology(def, new Set(['a', 'b', 'c']), 'wf')).toEqual([
        { message: "Workflow 'wf' contains an unreachable orphan node 'b'" },
        { message: "Workflow 'wf' contains an unreachable orphan node 'c'" }
      ]);
    });

    it('flags an infinite cyclic graph trap that has no path to the END sentinel', () => {
      const def = baseDef();
      def.nodes = { a: async () => ({}), b: async () => ({}) };
      def.edges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' }
      ];

      expect(checkTopology(def, new Set(['a', 'b']), 'wf')).toEqual([
        { message: "Workflow 'wf' is an infinite cyclic trap; no trajectory reaches 'END'" }
      ]);
    });

    it('handles large multi-node linear topologies with high performance without causing event loop lags', () => {
      const def = baseDef();
      const largeNodeSet = new Set<string>();

      def.nodes = {};
      def.edges = [];

      for (let i = 0; i < 100; i++) {
        const currentName = `node_${i}`;
        largeNodeSet.add(currentName);
        def.nodes[currentName] = async () => ({});

        if (i < 99) {
          def.edges.push({ from: currentName, to: `node_${i + 1}` });
        } else {
          def.edges.push({ from: currentName, to: END as any });
        }
      }

      def.entryNode = 'node_0';

      const startTime = performance.now();
      const violations = checkTopology(def, largeNodeSet, 'wf');
      const duration = performance.now() - startTime;

      expect(violations).toEqual([]);
      expect(duration).toBeLessThan(10);
    });

    it('flags single-node self-looping dead ends that disguise themselves as active trajectories', () => {
      const def = baseDef();
      def.nodes = { a: async () => ({}) };
      def.edges = [{ from: 'a', to: 'a' }]; // Self-pointing loop trap

      expect(checkTopology(def, new Set(['a']), 'wf')).toContainEqual({
        message: "Workflow 'wf' contains a self-looping dead-end at node 'a'"
      });
    });

    it('flags downstream multi-node infinite trap loops that stem cleanly from the entry point', () => {
      const def = baseDef();
      def.nodes = { a: async () => ({}), b: async () => ({}), c: async () => ({}) };
      def.edges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'b' } // Closed loop cycle down-stream from 'a'
      ];

      expect(checkTopology(def, new Set(['a', 'b', 'c']), 'wf')).toContainEqual({
        message: "Workflow 'wf' is an infinite cyclic trap; no trajectory reaches 'END'"
      });
    });
  });
});

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
import { createTestNodeContext } from '../nodeContext';
import type { ToolRegistry } from '../../types/tools/core';

const createMockRegistry = (tools: Record<string, (args: any, options?: any) => Promise<unknown>>): ToolRegistry => ({
  get: (id: string) => {
    const activeTool = tools[id];
    if (!activeTool) return undefined;

    return {
      id,
      name: id,
      description: 'Mock Enterprise Tool',
      inputSchema: {} as any,
      invoke: async (args: unknown, options?: any) => activeTool(args, options),
    };
  },
  list: () => [],
} as unknown as ToolRegistry);

describe('createTestNodeContext Utility Subsystem', () => {

  describe('1. Artifact Audit Lifecycle', () => {
    it('captures emitted execution payloads within an isolated, readable trace log', async () => {
      const ctx = createTestNodeContext({});
      
      await ctx.emitArtifact('security_scan', { ref: 'scan-01', url: 'https://security.local' });
      await ctx.emitArtifact('summary_report', { ref: 'report-1024' });

      expect(ctx.capturedArtifacts).toEqual([
        { kind: 'security_scan', payload: { ref: 'scan-01', url: 'https://security.local' } },
        { kind: 'summary_report', payload: { ref: 'report-1024' } }
      ]);
    });
  });

  describe('2. Security Sandbox Constraints (Allowlisting)', () => {
    it('instantly blocks and rejects tool calls that bypass the strict ID allow-list', async () => {
      const toolRegistry = createMockRegistry({ unauthorizedTool: async () => 'exploit' });
      const ctx = createTestNodeContext({ 
        toolRegistry, 
        allowedToolIds: ['authorizedToolOnly'] 
      });

      await expect(
        ctx.tools.invoke({ toolId: 'unauthorizedTool', args: {} })
      ).rejects.toThrowError(/not in the allow-list/);
    });

    it('flags and rejects execution requests for valid allow-listed tools missing from the registry', async () => {
      const emptyRegistry = createMockRegistry({});
      const ctx = createTestNodeContext({ 
        toolRegistry: emptyRegistry, 
        allowedToolIds: ['ghostTool'] 
      });

      await expect(
        ctx.tools.invoke({ toolId: 'ghostTool', args: {} })
      ).rejects.toThrowError(/not registered/);
    });

    it('routes parameters cleanly to registered and allow-listed tools on valid execution paths', async () => {
      const toolRegistry = createMockRegistry({ 
        multiply: async (args: any) => (args?.factor ?? 0) * 2 
      });
      const ctx = createTestNodeContext({ 
        toolRegistry, 
        allowedToolIds: ['multiply'] 
      });

      const result = await ctx.tools.invoke({ 
        toolId: 'multiply', 
        args: { factor: 5 } 
      });

      expect(result.toolId).toBe('multiply');
      expect(result.output).toBe(10);
    });

    // Enterprise Edge Case 1: Strict lock safety for empty allow-list definitions
    it('safeguards tool isolation when allowedToolIds is explicitly configured as an empty array', async () => {
      const toolRegistry = createMockRegistry({ targetTool: async () => 'data' });
      
      const ctx = createTestNodeContext({ 
        toolRegistry,
        allowedToolIds: [] // Setting an empty list should deny all tools
      });

      // The original code would allow this to pass because allowed.size would be 0.
      // If your business goal requires an empty list to fail closed, this assertion catches regressions.
      await expect(
        ctx.tools.invoke({ toolId: 'targetTool', args: {} })
      ).rejects.toThrowError();
    });
  });

  describe('3. Tool Execution Error & Property Handling', () => {
    // Enterprise Edge Case 2: Verification of tool exception propagation
    it('bubbles up raw error executions originating from within the internal tool driver layer unaltered', async () => {
      const toolRegistry = createMockRegistry({
        faultyTool: async () => {
          throw new Error('Database transaction timeout failure');
        }
      });

      const ctx = createTestNodeContext({
        toolRegistry,
        allowedToolIds: ['faultyTool']
      });

      await expect(
        ctx.tools.invoke({ toolId: 'faultyTool', args: {} })
      ).rejects.toThrowError('Database transaction timeout failure');
    });

    // Enterprise Edge Case 3: Execution Context Options Tracking (like options passing)
    it('passes host orchestration arguments and context constraints completely down to the invoking tool handler', async () => {
      let receivedOptions: any = null;
      const toolRegistry = createMockRegistry({
        inspectOptions: async (_args: any, options: any) => {
          receivedOptions = options;
          return 'ok';
        }
      });

      const ctx = createTestNodeContext({
        toolRegistry,
        allowedToolIds: ['inspectOptions']
      });

      await ctx.tools.invoke({
        toolId: 'inspectOptions',
        args: {},
        limits: { maxIterations: 5 } as any // Assert execution properties map down correctly
      });

      expect(receivedOptions).toBeDefined();
      expect(receivedOptions).toHaveProperty('identity', 'test-actor');
      expect(receivedOptions).toHaveProperty('runId', 'test-run');
    });
  });

  describe('4. Temporal Time Clock Anchoring', () => {
    it('provides a locked temporal milestone marker matching custom anchor date configurations', () => {
      const customMilestone = new Date('2035-12-25T12:00:00.000Z');
      const ctx = createTestNodeContext({ now: customMilestone });

      expect(ctx.now()).toEqual(customMilestone);
    });

    it('falls back seamlessly to a production baseline anchor date when no date configuration is supplied', () => {
      const ctx = createTestNodeContext({});
      
      expect(ctx.now().toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  describe('5. Lifecycle Control & Cancellation (AbortSignal Verification)', () => {
    it('immediately interrupts runtime tool tracking loops if an active AbortSignal is pre-tripped', async () => {
      const toolRegistry = createMockRegistry({ quickAction: async () => 'done' });
      const controller = new AbortController();
      
      controller.abort();

      const ctx = createTestNodeContext({ 
        toolRegistry, 
        allowedToolIds: ['quickAction'],
        signal: controller.signal 
      });

      await expect(
        ctx.tools.invoke({ toolId: 'quickAction', args: {} })
      ).rejects.toThrowError(/Operation aborted/);
    });
  });

});

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
import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AlertTunerPage } from './AlertTunerPage';
import { createMockApi } from '@webstackbuilders/storybook-workspace-infra/src/utils/mockUtils';

// Import your custom plugin API Reference identifier safely
import { alertTunerApiRef } from '@webstackbuilders/plugin-ai-agent-frontend-alert-ai-tuner';

const meta: Meta<typeof AlertTunerPage> = {
  title: 'Plugins/AgentCrewSuite/AlertTunerPage',
  component: AlertTunerPage,
};
export default meta;
type Story = StoryObj<typeof AlertTunerPage>;

// Centralized mock builder utility
const createMockHookReturnValue = (overrides = {}) => ({
  state: {
    phase: 'idle',
    runId: null,
    error: null,
    publication: null,
    rejected: false,
    proposal: null,
    approval: null,
    ...overrides,
  },
  evaluate: () => Promise.resolve(),
  resume: () => Promise.resolve(),
  decide: () => Promise.resolve(),
});

/** Baseline Initial State (Idle / Empty Canvas) */
export const DefaultIdle: Story = {
  loaders: [
    async () => {
      const mockApiInstance = createMockApi(['getLatestRun']);
      // Synchronously mock the return value BEFORE React component mounting runs
      mockApiInstance.getLatestRun.mockReturnValue(createMockHookReturnValue());
      return {
        mockApis: [
          [alertTunerApiRef, mockApiInstance]
        ]
      };
    }
  ]
};

/** Active Agent Calculation State (Triggers Backstage Progress Bars) */
export const AgentRunning: Story = {
  loaders: [
    async () => {
      const mockApiInstance = createMockApi(['getLatestRun']);
      mockApiInstance.getLatestRun.mockReturnValue(
        createMockHookReturnValue({
          phase: 'running',
          runId: 'run-9921-xyz',
        })
      );
      return {
        mockApis: [
          [alertTunerApiRef, mockApiInstance]
        ]
      };
    }
  ]
};

/** Agent Evaluation Failure State (Renders Error Paper component) */
export const AgenticError: Story = {
  loaders: [
    async () => {
      const mockApiInstance = createMockApi(['getLatestRun']);
      mockApiInstance.getLatestRun.mockReturnValue(
        createMockHookReturnValue({
          phase: 'error',
          error: 'Failed to synthesize IaC Proposal: LLM token generation limit exceeded on gateway node-4.',
        })
      );
      return {
        mockApis: [
          [alertTunerApiRef, mockApiInstance]
        ]
      };
    }
  ]
};

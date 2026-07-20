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
import { describe, expect, it, vi } from 'vitest';
import { createObservabilityTools } from '../registerTools';
import { ObservabilityDriver } from '../../providers';

const createMockDriver = (overrides: Partial<ObservabilityDriver> = {}): ObservabilityDriver => ({
  providerId: 'mock',
  listActiveIncidents: vi.fn().mockResolvedValue([]),
  getAlertHistory: vi.fn().mockResolvedValue([]),
  queryMetrics: vi.fn().mockResolvedValue([]),
  searchLogs: vi.fn().mockResolvedValue([]),
  searchTraces: vi.fn().mockResolvedValue([]),
  annotateIncident: vi.fn().mockResolvedValue({ incidentId: 'INC-1', annotated: true }),
  suggestAlertTuning: vi.fn().mockResolvedValue({ alertId: 'A-1', suggestion: 'tune' }),
  ...overrides,
});

const createMockLogger = () => ({
  debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn().mockReturnThis(),
});

const ctx = {
  logger: createMockLogger() as never,
  identity: 'test-user',
  runId: 'test-run',
  signal: new AbortController().signal,
};

describe('createObservabilityTools', () => {
  it('registers the expected stable tool IDs', () => {
    const tools = createObservabilityTools({
      alertingDriver: createMockDriver(),
      metricsDriver: createMockDriver(),
      tracesDriver: createMockDriver(),
      logger: createMockLogger() as never,
    });
    expect(tools.map(t => t.id)).toEqual([
      'observability.incident.list_active',
      'observability.alert.history',
      'observability.metrics.query',
      'observability.logs.search',
      'observability.traces.search',
      'observability.incident.annotate',
      'observability.alert.suggest_tuning',
    ]);
  });

  it('marks incident.annotate as write', () => {
    const tools = createObservabilityTools({
      alertingDriver: createMockDriver(),
      metricsDriver: createMockDriver(),
      tracesDriver: createMockDriver(),
      logger: createMockLogger() as never,
    });
    const annotateTool = tools.find(t => t.id === 'observability.incident.annotate');
    expect(annotateTool?.effect).toBe('write');
  });

  it('observability.incident.list_active delegates to alertingDriver', async () => {
    const alertingDriver = createMockDriver();
    const tools = createObservabilityTools({
      alertingDriver,
      metricsDriver: createMockDriver(),
      tracesDriver: createMockDriver(),
      logger: createMockLogger() as never,
    });
    const tool = tools.find(t => t.id === 'observability.incident.list_active')!;
    await tool.invoke({ service: 'api' }, ctx);
    expect(alertingDriver.listActiveIncidents).toHaveBeenCalledWith({ service: 'api' });
  });
});

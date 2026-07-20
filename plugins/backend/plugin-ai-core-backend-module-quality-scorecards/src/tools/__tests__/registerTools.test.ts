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
import { createQualityScorecardTools } from '../registerTools';
import { QualityScorecardDriver } from '../../providers';

const createMockDriver = (overrides: Partial<QualityScorecardDriver> = {}): QualityScorecardDriver => ({
  providerId: 'mock',
  getScorecard: vi.fn().mockResolvedValue(undefined),
  listChecks: vi.fn().mockResolvedValue([]),
  lookupTechRadar: vi.fn().mockResolvedValue(undefined),
  getServiceProfile: vi.fn().mockResolvedValue({ entityRef: 'component:default/test' }),
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

describe('createQualityScorecardTools', () => {
  it('registers the expected stable tool IDs', () => {
    const tools = createQualityScorecardTools({ driver: createMockDriver(), logger: createMockLogger() as never });
    expect(tools.map(t => t.id)).toEqual([
      'quality.scorecard.get',
      'quality.checks.list',
      'quality.tech_radar.lookup',
      'quality.service_profile.get',
    ]);
  });

  it('marks all tools as read', () => {
    const tools = createQualityScorecardTools({ driver: createMockDriver(), logger: createMockLogger() as never });
    for (const tool of tools) {
      expect(tool.effect).toBe('read');
    }
  });

  it('quality.scorecard.get delegates to driver', async () => {
    const driver = createMockDriver();
    const tools = createQualityScorecardTools({ driver, logger: createMockLogger() as never });
    const tool = tools.find(t => t.id === 'quality.scorecard.get')!;
    await tool.invoke({ entityRef: 'component:default/test' }, ctx);
    expect(driver.getScorecard).toHaveBeenCalledWith({ entityRef: 'component:default/test' });
  });
});

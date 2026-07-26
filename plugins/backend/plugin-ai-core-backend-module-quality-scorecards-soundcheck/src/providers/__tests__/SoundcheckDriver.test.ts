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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoundcheckDriver } from '../SoundcheckDriver';

describe('SoundcheckDriver Integration Evaluation', () => {
  const mockLogger = { debug: vi.fn(), error: vi.fn(), info: vi.fn() };
  
  // Construct an authentic mock instance mimicking the Spotify backend service contract
  let mockSoundcheckService: any;
  let driver: SoundcheckDriver;

  beforeEach(() => {
    mockSoundcheckService = {
      getResults: vi.fn(),
    };

    driver = new SoundcheckDriver({
      logger: mockLogger,
      soundcheckService: mockSoundcheckService,
    });

    vi.restoreAllMocks();
  });

  it('correctly maps raw Spotify Soundcheck program payloads to standardized summary models', async () => {
    const entityRef = 'component:default/order-service';
    
    // Simulate Soundcheck database query outputs
    mockSoundcheckService.getResults.mockResolvedValueOnce({
      highestLevelPassing: true,
      checks: [
        {
          id: 'test-coverage-check',
          name: 'SonarQube Test Coverage > 80%',
          category: 'code-quality',
          value: true,
          factValue: 84.2,
        },
        {
          id: 'pagerduty-integration-check',
          name: 'On-Call PagerDuty Escalation Mapped',
          category: 'operations',
          value: false,
          factValue: null,
        }
      ],
    });

    const summary = await driver.getEntityScorecard(entityRef);

    expect(mockSoundcheckService.getResults).toHaveBeenCalledWith({ entityRef });
    expect(summary).toEqual({
      entityRef,
      overallStatus: 'passed',
      results: [
        {
          checkId: 'test-coverage-check',
          name: 'SonarQube Test Coverage > 80%',
          category: 'code-quality',
          status: 'passed',
          factValue: 84.2,
        },
        {
          checkId: 'pagerduty-integration-check',
          name: 'On-Call PagerDuty Escalation Mapped',
          category: 'operations',
          status: 'failed',
          factValue: null,
        }
      ],
    });
  });

  it('transparently propagates downstream service rejections up the platform execution track', async () => {
    mockSoundcheckService.getResults.mockRejectedValueOnce(new Error('Soundcheck Database Connection Interrupted'));

    await expect(
      driver.getEntityScorecard('component:default/unreachable-service')
    ).rejects.toThrow(/Soundcheck Database Connection Interrupted/);
  });
});

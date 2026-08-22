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
import { describe, expect, it } from 'vitest';
import { planSweep } from '../sweepPlanner';

const NOW = new Date('2026-02-01T06:00:00.000Z');

describe('planSweep', () => {
  /** Every planned dispatch must be scheduler-sourced and propose-only. */
  it('plans propose-only scheduler runs for each service', () => {
    const plans = planSweep({
      services: ['checkout', 'payments'],
      windowDays: 14,
      maxSweepAlerts: 25,
      cooldownDays: 30,
      now: () => NOW,
    });

    expect(plans).toHaveLength(2);
    expect(plans[0]).toMatchObject({
      id: 'alert-ai-tuner-sweep-checkout',
      request: { version: 1, source: 'scheduler', service: 'checkout', publish: false },
    });
    expect(plans.every((plan) => plan.request.publish === false)).toBe(true);
  });

  /** The cap bounds fan-out so a large inventory cannot flood the runtime. */
  it('caps the plan at the configured sweep limit', () => {
    const plans = planSweep({
      services: ['a', 'b', 'c', 'd'],
      windowDays: 14,
      maxSweepAlerts: 2,
      cooldownDays: 30,
      now: () => NOW,
    });

    expect(plans.map((plan) => plan.request.service)).toEqual(['a', 'b']);
  });

  /** A target proposed inside the cooldown must be skipped, not re-proposed. */
  it('skips targets still inside the re-proposal cooldown', () => {
    const plans = planSweep({
      services: ['checkout', 'payments'],
      windowDays: 14,
      maxSweepAlerts: 25,
      cooldownDays: 30,
      history: [
        { target: 'checkout', proposedAt: '2026-01-25T00:00:00.000Z' },
        { target: 'payments', proposedAt: '2025-11-01T00:00:00.000Z' },
      ],
      now: () => NOW,
    });

    expect(plans.map((plan) => plan.request.service)).toEqual(['payments']);
  });

  /** Duplicate and empty inventory entries must not produce duplicate runs. */
  it('deduplicates and drops empty service entries', () => {
    const plans = planSweep({
      services: ['checkout', 'checkout', ''],
      windowDays: 14,
      maxSweepAlerts: 25,
      cooldownDays: 30,
      now: () => NOW,
    });

    expect(plans).toHaveLength(1);
  });
});

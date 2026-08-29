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
import { overlaps, applySuppression, toSuppressionWindows, type SuppressionWindow } from '../correlate';
import type { FiringSample, NoiseScore } from '../state';

describe('correlate Operational Algorithm Engine Block', () => {
  const baseTime = new Date('2026-02-01T12:00:00.000Z').getTime();
  const format = (ms: number) => new Date(ms).toISOString();

  describe('overlaps calculation engine', () => {
    it('returns true when an event overlaps a suppression window cleanly without any padding required', () => {
      const sample = { triggeredAt: format(baseTime), resolvedAt: format(baseTime + 60000) } as FiringSample;
      const window: SuppressionWindow = { id: 'inc-1', start: format(baseTime + 30000), end: format(baseTime + 90000) };

      expect(overlaps(sample, window, 0)).toBe(true);
    });

    it('leverages the padding parameter to register a match even if an entry occurs just before an incident starts', () => {
      const sample = { triggeredAt: format(baseTime - 120000), resolvedAt: format(baseTime - 60000) } as FiringSample;
      const window: SuppressionWindow = { id: 'inc-1', start: format(baseTime), end: format(baseTime + 60000) };

      // With 2 minutes padding (120,000ms), a match is registered
      expect(overlaps(sample, window, 2)).toBe(true);
      // With 0 minutes padding, the ranges do not intersect
      expect(overlaps(sample, window, 0)).toBe(false);
    });

    it('handles missing or failed resolved/ended timestamps gracefully by falling back to the start anchor timestamp', () => {
      const instantaneousSample = { triggeredAt: format(baseTime), resolvedAt: undefined } as FiringSample;
      const openEndedWindow: SuppressionWindow = { id: 'inc-1', start: format(baseTime), end: undefined };

      expect(overlaps(instantaneousSample, openEndedWindow, 0)).toBe(true);
    });

    it('safely breaks out and returns false if a timestamp parameter is corrupt or unparseable', () => {
      const cleanSample = { triggeredAt: format(baseTime), resolvedAt: format(baseTime + 1000) } as FiringSample;
      const brokenWindow: SuppressionWindow = { id: 'inc-1', start: 'corrupt-date-string' };

      expect(overlaps(cleanSample, brokenWindow, 10)).toBe(false);
    });
  });

  describe('applySuppression business logic tier', () => {
    const mockBaselineScore = { verdict: 'noisy', reasons: ['High clear rate'] } as unknown as NoiseScore;

    it('leaves the original structural score untouched if no overlap triggers are detected', () => {
      const samples = [{ triggeredAt: format(baseTime) }] as FiringSample[];
      const windows: SuppressionWindow[] = [{ id: 'inc-1', start: format(baseTime + 100000) }];

      const score = applySuppression(mockBaselineScore, samples, windows, 0);
      expect(score).toEqual(mockBaselineScore);
    });

    it('forces the operational verdict to real_signal and appends unique suppression IDs if intersection occurs', () => {
      const samples = [{ triggeredAt: format(baseTime) }] as FiringSample[];
      const windows: SuppressionWindow[] = [
        { id: 'inc-1', start: format(baseTime) },
        { id: 'inc-1', start: format(baseTime) }, // Duplicate target window
        { id: 'inc-2', start: format(baseTime) }
      ];

      const score = applySuppression(mockBaselineScore, samples, windows, 0);

      expect(score.verdict).toBe('real_signal');
      expect(score.suppressedBy).toEqual(['inc-1', 'inc-2']);
    });
  });

  describe('toSuppressionWindows record transformer matrix', () => {
    it('iterates through multi-schema tool structures and yields uniform structural windows and evidence references', () => {
      const mixedThirdPartyRecords = [
        { triggeredAt: format(baseTime), title: 'Incident A', url: 'https://pagerduty.com' },
        { startedAt: format(baseTime + 1000), summary: 'Deploy B', htmlUrl: 'https://github.com' },
        { observedAt: format(baseTime + 2000), reason: 'Alert C', id: 'id-3' },
        { timestamp: format(baseTime + 3000), message: 'Log D' },
        { missingTimeProperty: 'corrupt' } // Discarded safely!
      ];

      const { windows, evidence } = toSuppressionWindows(mixedThirdPartyRecords, {
        prefix: 'evt',
        source: 'incident',
        max: 10
      });

      expect(windows).toHaveLength(4);
      expect(evidence).toHaveLength(4);

      expect(windows[0]).toEqual({ id: 'evt-1', start: format(baseTime), end: undefined });
      expect(evidence[0]).toEqual({
        id: 'evt-1',
        source: 'incident',
        summary: 'Incident A',
        reference: 'https://pagerduty.com'
      });

      expect(evidence[1].summary).toBe('Deploy B');
      expect(evidence[2].summary).toBe('Alert C');
      expect(evidence[3].summary).toBe('Log D');
    });

    it('safely isolates code execution paths from execution exceptions if data maps pass non-array variants', () => {
      const result = toSuppressionWindows(null, { prefix: 'test', source: 'deploy', max: 5 });
      expect(result.windows).toEqual([]);
      expect(result.evidence).toEqual([]);
    });

    it('strictly applies hard array allocation limits according to configuration capacity numbers', () => {
      const records = [
        { timestamp: format(baseTime) },
        { timestamp: format(baseTime) },
        { timestamp: format(baseTime) }
      ];

      const { windows } = toSuppressionWindows(records, { prefix: 'test', source: 'deploy', max: 1 });
      expect(windows).toHaveLength(1);
    });
  });
});

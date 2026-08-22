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
import { toFiringEvidence, toFiringSamples } from '../history';
import { parseAlertTuningQuery } from '../request';

const WINDOW = { from: '2026-01-01T00:00:00.000Z', to: '2026-01-31T00:00:00.000Z' };

describe('toFiringSamples', () => {
  /** Durations must be derived from the timestamps, never trusted as given. */
  it('derives durations and assigns stable citation identifiers', () => {
    const samples = toFiringSamples(
      [
        {
          id: 'a',
          title: 'CPU high',
          triggeredAt: '2026-01-10T00:00:00.000Z',
          resolvedAt: '2026-01-10T00:01:30.000Z',
          resolution: 'auto',
          paged: false,
        },
      ],
      WINDOW,
      500
    );

    expect(samples).toEqual([
      {
        id: 'fire-1',
        triggeredAt: '2026-01-10T00:00:00.000Z',
        resolvedAt: '2026-01-10T00:01:30.000Z',
        durationSeconds: 90,
        resolution: 'auto',
        paged: false,
      },
    ]);
  });

  /** Entries outside the analysis window must not reach the statistics. */
  it('drops entries outside the window and those with no trigger time', () => {
    const samples = toFiringSamples(
      [
        { id: 'a', title: 'old', triggeredAt: '2025-01-01T00:00:00.000Z' },
        { id: 'b', title: 'untimed' },
        { id: 'c', title: 'kept', triggeredAt: '2026-01-15T00:00:00.000Z' },
      ],
      WINDOW,
      500
    );

    expect(samples.map((sample) => sample.triggeredAt)).toEqual(['2026-01-15T00:00:00.000Z']);
  });

  /** Unresolved firings must carry no duration to skew the percentiles. */
  it('records unresolved firings without a duration', () => {
    const [sample] = toFiringSamples(
      [{ id: 'a', title: 'stuck', triggeredAt: '2026-01-10T00:00:00.000Z' }],
      WINDOW,
      500
    );

    expect(sample).toMatchObject({ resolution: 'unresolved', durationSeconds: undefined });
  });

  /** The cap must retain the newest firings so recent behaviour dominates. */
  it('caps retained samples newest-first', () => {
    const entries = Array.from({ length: 5 }, (_unused, index) => ({
      id: `a-${index}`,
      title: 'CPU high',
      triggeredAt: new Date(Date.UTC(2026, 0, 10 + index)).toISOString(),
    }));

    const samples = toFiringSamples(entries, WINDOW, 2);

    expect(samples.map((sample) => sample.triggeredAt)).toEqual([
      '2026-01-14T00:00:00.000Z',
      '2026-01-13T00:00:00.000Z',
    ]);
  });

  /** Evidence summaries must stay free of alert titles and responder identities. */
  it('summarizes evidence without alert payload detail', () => {
    const samples = toFiringSamples(
      [
        {
          id: 'a',
          title: 'CPU high on prod-db-01',
          triggeredAt: '2026-01-10T00:00:00.000Z',
          resolvedAt: '2026-01-10T00:01:30.000Z',
          resolution: 'auto',
        },
      ],
      WINDOW,
      500
    );

    const [evidence] = toFiringEvidence(samples);

    expect(evidence.id).toBe('fire-1');
    expect(evidence.summary).toContain('cleared after 90s');
    expect(evidence.summary).not.toContain('prod-db-01');
  });
});

describe('parseAlertTuningQuery', () => {
  const bounds = { defaultDays: 14, maxDays: 30 };

  /** The window must be clamped so a caller cannot request unbounded history. */
  it('clamps the requested window to the configured maximum', () => {
    const request = parseAlertTuningQuery(
      JSON.stringify({ version: 1, source: 'manual', service: 'checkout', windowDays: 900 }),
      'manual',
      bounds
    );

    expect(request.windowDays).toBe(30);
  });

  /** Traversal paths must never reach a repository read tool. */
  it('rejects a traversal IaC path', () => {
    expect(() =>
      parseAlertTuningQuery(
        JSON.stringify({
          version: 1,
          source: 'manual',
          service: 'checkout',
          iacPath: '../../etc/passwd',
        }),
        'manual',
        bounds
      )
    ).toThrow(/bounded repository-relative path/);
  });

  /** Unknown payload versions must be rejected rather than best-effort parsed. */
  it('rejects an unsupported payload version', () => {
    expect(() =>
      parseAlertTuningQuery(JSON.stringify({ version: 2, service: 'checkout' }), 'manual', bounds)
    ).toThrow(/Unsupported request version/);
  });
});

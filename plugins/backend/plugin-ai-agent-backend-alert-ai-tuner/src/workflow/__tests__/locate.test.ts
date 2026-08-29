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
import { locateThresholdAnchor } from '../locate';

const HCL_FILE = [
  'resource "prometheus_alert" "disk_low" {',
  '  threshold = 10',
  '}',
  '',
  'resource "prometheus_alert" "cpu_high" {',
  '  threshold = 85',
  '  for       = "2m"',
  '}',
].join('\n');

const PROMETHEUS_FILE = [
  'groups:',
  '  - name: platform',
  '    rules:',
  '      - alert: CpuHigh',
  '        expr: cpu_usage > 85',
  '        for: 2m',
  '      - alert: DiskLow',
  '        expr: disk_free < 10',
  '        for: 5m',
].join('\n');

describe('locateThresholdAnchor Engine Isolation Suite', () => {
  /** Happy Path Validation */
  it('locates an HCL alert block with its assignment line numbers', () => {
    const result = locateThresholdAnchor({
      path: 'alerts.tf',
      content: HCL_FILE,
      alertName: 'cpu_high',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.anchor.blockName).toBe('prometheus_alert.cpu_high');
    expect(result.anchor.currentThreshold).toMatchObject({ value: '85', line: 6 });
    expect(result.anchor.currentDuration).toMatchObject({ value: '2m', line: 7 });
  });

  /** Dialect Compatibility Tracking */
  it('locates a Prometheus rule entry without bleeding into the next rule', () => {
    const result = locateThresholdAnchor({
      path: 'prometheus-rules.yaml',
      content: PROMETHEUS_FILE,
      alertName: 'cpu_high',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.anchor.blockName).toBe('CpuHigh');
    expect(result.anchor.currentDuration).toMatchObject({ value: '2m', line: 6 });
  });

  /** Failure Isolation Rules */
  it('reports no match rather than guessing a block', () => {
    const result = locateThresholdAnchor({
      path: 'alerts.tf',
      content: HCL_FILE,
      alertName: 'memory_pressure',
    });

    expect(result).toMatchObject({ ok: false, reason: 'no_match' });
  });

  /** Ambiguity Traps */
  it('reports ambiguity when several blocks match', () => {
    const duplicated = `${HCL_FILE}\n${HCL_FILE.split('\n').slice(4).join('\n')}`;

    const result = locateThresholdAnchor({
      path: 'alerts.tf',
      content: duplicated,
      alertName: 'cpu_high',
    });

    expect(result).toMatchObject({ ok: false, reason: 'ambiguous_match' });
  });

  /** Field Detection Failures */
  it('reports a matched block that exposes no tunable field', () => {
    const result = locateThresholdAnchor({
      path: 'alerts.tf',
      content: 'resource "prometheus_alert" "cpu_high" {\n  labels = {}\n}',
      alertName: 'cpu_high',
    });

    expect(result).toMatchObject({ ok: false, reason: 'no_tunable_field' });
  });

  it('safely handles deeply nested structures and inline text brace patterns without premature truncation', () => {
    const complexHclPayload = [
      'resource "prometheus_alert" "cpu_high" {',
      '  meta {',
      '    summary = "Alert triggered for high cpu {instance_id}"', // Inline brace injection!
      '    nested_details {',
      '      active = true',
      '    }',
      '  }',
      '  threshold = 90', // downstream target assignment parameter
      '}',
    ].join('\n');

    const result = locateThresholdAnchor({
      path: 'complex-nested.tf',
      content: complexHclPayload,
      alertName: 'cpu_high',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Confirms tracking brace depths correctly found the field at line index 8 instead of dropping on line 3
    expect(result.anchor.currentThreshold).toMatchObject({ value: '90', line: 8 });
  });

  it('safely processes blank or flat un-broken string payloads without throwing lookup failures', () => {
    const emptyResult = locateThresholdAnchor({
      path: 'empty.tf',
      content: '',
      alertName: 'cpu_high',
    });

    expect(emptyResult).toMatchObject({ ok: false, reason: 'no_match', matches: 0 });
  });

  it('tolerates custom value formats like negative metrics limits inside rule definitions', () => {
    const negativeValueHcl = [
      'resource "prometheus_alert" "temp_low" {',
      '  critical = -15.5', // Negative float parsing challenge
      '}',
    ].join('\n');

    const result = locateThresholdAnchor({
      path: 'negative.tf',
      content: negativeValueHcl,
      alertName: 'temp_low',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.anchor.currentThreshold).toMatchObject({ value: '-15.5', line: 2 });
  });
});

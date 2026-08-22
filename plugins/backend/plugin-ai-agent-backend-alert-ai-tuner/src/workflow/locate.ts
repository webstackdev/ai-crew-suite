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
import type { AnchorField, ThresholdAnchor } from './state';

/** Why an anchor could not be resolved unambiguously. */
export type LocateFailure = 'no_match' | 'ambiguous_match' | 'no_tunable_field';

/** Either exactly one located anchor or a named, terminal failure reason. */
export type LocateResult =
  | { ok: true; anchor: ThresholdAnchor; reason?: undefined }
  | { ok: false; reason: LocateFailure; matches: number };

/** A candidate alert block discovered inside an IaC file. */
type BlockMatch = { name: string; startLine: number; endLine: number };

/** Normalizes an alert identifier so `cpu_high` matches `CPU Utilization High`. */
const normalizeName = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Finds HCL alert blocks such as `resource "prometheus_alert" "cpu_high" {`.
 * Block extent is tracked by brace depth so nested blocks do not truncate the
 * parent, keeping assignment discovery inside the correct definition.
 */
const findHclBlocks = (lines: string[]): BlockMatch[] => {
  const blocks: BlockMatch[] = [];
  const header = /^\s*(?:resource|module)?\s*"?([A-Za-z0-9_.-]+)"?\s+"([A-Za-z0-9_.-]+)"\s*\{/;

  for (let index = 0; index < lines.length; index += 1) {
    const match = header.exec(lines[index]);
    if (!match) continue;

    let depth = 0;
    let endLine = index;

    for (let cursor = index; cursor < lines.length; cursor += 1) {
      depth += (lines[cursor].match(/\{/g) ?? []).length;
      depth -= (lines[cursor].match(/\}/g) ?? []).length;
      endLine = cursor;
      if (depth <= 0) break;
    }

    blocks.push({ name: `${match[1]}.${match[2]}`, startLine: index, endLine });
  }

  return blocks;
};

/**
 * Finds Prometheus rule entries such as `- alert: CpuHigh`. The entry extends
 * to the next list item at the same indentation, which bounds assignment
 * discovery without needing a YAML parser.
 */
const findPrometheusBlocks = (lines: string[]): BlockMatch[] => {
  const blocks: BlockMatch[] = [];
  const header = /^(\s*)-\s+alert:\s*"?([^"\n]+?)"?\s*$/;

  for (let index = 0; index < lines.length; index += 1) {
    const match = header.exec(lines[index]);
    if (!match) continue;

    const indent = match[1].length;
    let endLine = lines.length - 1;

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const next = /^(\s*)-\s+alert:/.exec(lines[cursor]);
      if (next && next[1].length <= indent) {
        endLine = cursor - 1;
        break;
      }
    }

    blocks.push({ name: match[2].trim(), startLine: index, endLine });
  }

  return blocks;
};

/** Extracts the first matching assignment line within a bounded block range. */
const findField = (
  lines: string[],
  block: BlockMatch,
  pattern: RegExp
): AnchorField | undefined => {
  for (let index = block.startLine; index <= block.endLine; index += 1) {
    const match = pattern.exec(lines[index]);
    if (match) {
      return { value: match[1], line: index + 1, raw: lines[index] };
    }
  }
  return undefined;
};

const THRESHOLD_PATTERN = /(?:threshold|value|critical)\s*[:=]\s*"?(-?\d+(?:\.\d+)?)"?/i;
const DURATION_PATTERN = /(?:duration|for|period)\s*[:=]\s*"?(\d+[smhd])"?/i;

/**
 * Locates the tunable assignment lines for one alert definition inside a single
 * IaC file, supporting both HCL resource blocks and Prometheus rule YAML.
 *
 * Ambiguity is always terminal: zero matches and multiple matches both return a
 * failure rather than a guess, because patching the wrong block would edit
 * unrelated infrastructure. A matched block with no tunable assignment is also
 * a failure rather than an empty patch.
 *
 * @param input - The file content, its repository path, and the alert name to match.
 */
export const locateThresholdAnchor = (input: {
  path: string;
  content: string;
  alertName: string;
}): LocateResult => {
  const lines = input.content.split('\n');
  const blocks = [...findHclBlocks(lines), ...findPrometheusBlocks(lines)];
  const target = normalizeName(input.alertName);

  const matches = blocks.filter((block) => {
    const name = normalizeName(block.name);
    return name.includes(target) || target.includes(name);
  });

  if (matches.length === 0) {
    return { ok: false, reason: 'no_match', matches: 0 };
  }

  if (matches.length > 1) {
    return { ok: false, reason: 'ambiguous_match', matches: matches.length };
  }

  const [block] = matches;
  const currentThreshold = findField(lines, block, THRESHOLD_PATTERN);
  const currentDuration = findField(lines, block, DURATION_PATTERN);

  if (!currentThreshold && !currentDuration) {
    return { ok: false, reason: 'no_tunable_field', matches: 1 };
  }

  return {
    ok: true,
    anchor: {
      path: input.path,
      blockName: block.name,
      currentThreshold,
      currentDuration,
      evidence: ['iac-1'],
    },
  };
};

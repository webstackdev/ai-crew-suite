import type { IncidentEvidence } from './state';

const REDACTION_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  // Bearer tokens (before key/value matching so the token itself is removed)
  { pattern: /Bearer\s+[A-Za-z0-9._~+/=-]+/gi, replacement: '[REDACTED]' },
  // key=value or key: value credential assignments
  {
    pattern:
      /\b(password|passwd|secret|token|api[-_]?key|access[-_]?key|authorization|credential)(=|:\s?)("?)[^\s"']+\2?/gi,
    replacement: '$1$2[REDACTED]',
  },
  // AWS-style access key IDs
  { pattern: /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g, replacement: '[REDACTED_AWS_KEY_ID]' },
  // PEM blocks
  {
    pattern:
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: '[REDACTED_PRIVATE_KEY]',
  },
];

/**
 * Redacts credential-like strings from free text before it enters model
 * context, SSE events, artifacts, or test snapshots.
 */
export const redactSensitiveText = (text: string): string => {
  let redacted = text;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
};

export type NormalizeEvidenceOptions = {
  /** Maximum number of evidence items retained for the report. */
  maxItems: number;
  /** Maximum characters retained for a single evidence summary. */
  maxSummaryLength?: number;
};

/**
 * Normalizes a raw evidence bundle: redacts summaries, deduplicates by ID
 * (first occurrence wins), sorts by observation time (undated items last, in
 * stable order), and caps the bundle to the configured size.
 */
export const normalizeEvidence = (
  items: IncidentEvidence[],
  options: NormalizeEvidenceOptions,
): { evidence: IncidentEvidence[]; dropped: number } => {
  const maxSummaryLength = options.maxSummaryLength ?? 1_024;

  const seen = new Set<string>();
  const deduped: IncidentEvidence[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    deduped.push({
      ...item,
      summary: redactSensitiveText(item.summary).slice(0, maxSummaryLength),
    });
  }

  const sorted = deduped
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aTime = a.item.observedAt ? Date.parse(a.item.observedAt) : NaN;
      const bTime = b.item.observedAt ? Date.parse(b.item.observedAt) : NaN;
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
        return a.index - b.index;
      }
      if (Number.isNaN(aTime)) {
        return 1;
      }
      if (Number.isNaN(bTime)) {
        return -1;
      }
      return aTime - bTime;
    })
    .map(entry => entry.item);

  return {
    evidence: sorted.slice(0, options.maxItems),
    dropped: Math.max(0, sorted.length - options.maxItems),
  };
};

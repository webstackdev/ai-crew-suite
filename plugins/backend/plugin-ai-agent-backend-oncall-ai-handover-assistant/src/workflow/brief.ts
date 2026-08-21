/*
 * Copyright 2026 Webstack Builders, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
import type { HandoverBrief, HandoverRequest, IncidentCluster, RawSignal } from './state';

const briefStatus = (signals: RawSignal[], limitations: string[]): HandoverBrief['status'] => {
  if (signals.length === 0) return 'no_activity';
  if (limitations.length > 0) return 'partial';
  return 'compiled';
};
/** Builds a deterministic citation-safe brief when model synthesis is absent or invalid. */
export const buildHandoverBrief = (input: { request: HandoverRequest; window: { start: string; end: string }; signals: RawSignal[]; clusters: IncidentCluster[]; limitations: string[]; currentOncall?: string }): HandoverBrief => {
  const active = input.clusters.filter(cluster => cluster.status === 'active');
  return { window: input.window, team: input.request.team, incomingEngineer: input.request.incomingEngineer, currentOncall: input.currentOncall, status: briefStatus(input.signals, input.limitations), highlights: active.map(cluster => ({ text: `${cluster.count}× ${cluster.title}`, severity: 'high' as const, citations: cluster.signals })), activeIncidents: active, openTickets: input.signals.filter(signal => signal.kind === 'ticket').map(signal => ({ key: signal.reference ?? signal.id, summary: signal.summary, status: signal.status ?? 'unknown', citation: signal.id })), notableChanges: input.signals.filter(signal => signal.kind === 'deployment' || signal.kind === 'pr').map(signal => ({ summary: signal.summary, citation: signal.id })), recommendedWatchItems: active.map(cluster => `Monitor ${cluster.title}`), limitations: input.limitations, signals: input.signals };
};

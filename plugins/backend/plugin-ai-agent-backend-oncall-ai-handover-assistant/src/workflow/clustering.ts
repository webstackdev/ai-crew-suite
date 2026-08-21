/*
 * Copyright 2026 Webstack Builders, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
import type { IncidentCluster, RawSignal } from './state';

const clusterStatus = (items: RawSignal[]): IncidentCluster['status'] => {
  if (items.some(item => item.status === 'active')) return 'active';
  if (items.some(item => item.status === 'resolved')) return 'resolved';
  return 'unknown';
};
/** Groups repeated incident signals by service/title within the retained window. */
export const clusterSignals = (signals: RawSignal[], maxClusters: number): IncidentCluster[] => {
  const grouped = new Map<string, RawSignal[]>();
  for (const signal of signals.filter(item => item.source === 'incident')) {
    const key = `${signal.service ?? ''}|${signal.summary.toLowerCase()}`;
    grouped.set(key, [...(grouped.get(key) ?? []), signal]);
  }
  return [...grouped.values()].map((items, index) => {
    const times = items.map(item => item.observedAt ?? '').filter(Boolean).sort();
    return { id: `cluster-${index + 1}`, service: items[0]?.service, title: items[0]?.summary ?? 'Unknown incident', count: items.length, firstSeen: times[0] ?? '', lastSeen: times.at(-1) ?? '', status: clusterStatus(items), signals: items.map(item => item.id), correlated: signals.filter(item => item.source !== 'incident' && items.some(incident => incident.service && incident.service === item.service)).map(item => item.id) };
  }).sort((a, b) => b.count - a.count).slice(0, maxClusters);
};

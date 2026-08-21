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
import {
  extractIntegrationReferences,
  toCatalogEntityRelations,
  toCatalogEntitySummary,
} from '../mapping';

const paymentGateway = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    namespace: 'default',
    name: 'payment-gateway',
    title: 'Payment Gateway',
    description: 'Handles card payments',
    annotations: {
      'backstage.io/kubernetes-id': 'payment-gateway',
      'pagerduty.com/service-id': 'PABC123',
      'github.com/project-slug': 'acme/payment-gateway',
      'backstage.io/techdocs-ref': 'dir:.',
      'backstage.io/source-location':
        'url:https://github.com/acme/payment-gateway',
      'datadoghq.com/dashboard-url': 'https://app.datadoghq.com/dashboard/abc',
    },
    tags: ['payments', 'critical'],
  },
  spec: { type: 'service', lifecycle: 'production', owner: 'team-alpha' },
  relations: [
    { type: 'dependsOn', targetRef: 'component:default/db-pool' },
    { type: 'ownedBy', targetRef: 'group:default/team-alpha' },
    { type: 'malformed' },
  ],
};

describe('toCatalogEntitySummary', () => {
  it('maps a full entity into the compact summary shape', () => {
    const summary = toCatalogEntitySummary(paymentGateway);

    expect(summary).toEqual({
      ref: 'component:default/payment-gateway',
      kind: 'Component',
      namespace: 'default',
      name: 'payment-gateway',
      title: 'Payment Gateway',
      description: 'Handles card payments',
      type: 'service',
      lifecycle: 'production',
      owner: 'team-alpha',
      system: undefined,
      annotations: paymentGateway.metadata.annotations,
      tags: ['payments', 'critical'],
    });
  });

  it('tolerates missing metadata without throwing', () => {
    const summary = toCatalogEntitySummary({});

    expect(summary.ref).toBe('unknown:default/unknown');
    expect(summary.annotations).toEqual({});
    expect(summary.tags).toEqual([]);
  });

  it('drops non-string annotation values', () => {
    const summary = toCatalogEntitySummary({
      kind: 'Component',
      metadata: {
        name: 'x',
        annotations: { ok: 'yes', bad: 42 as unknown as string },
      },
    });

    expect(summary.annotations).toEqual({ ok: 'yes' });
  });
});

describe('toCatalogEntityRelations', () => {
  it('keeps well-formed relation edges and drops malformed ones', () => {
    expect(toCatalogEntityRelations(paymentGateway)).toEqual([
      { type: 'dependsOn', targetRef: 'component:default/db-pool' },
      { type: 'ownedBy', targetRef: 'group:default/team-alpha' },
    ]);
  });

  it('returns an empty list when relations are absent', () => {
    expect(toCatalogEntityRelations({})).toEqual([]);
  });
});

describe('extractIntegrationReferences', () => {
  it('extracts kubernetes, on-call, repository, monitoring, and docs handles', () => {
    expect(extractIntegrationReferences(paymentGateway)).toEqual({
      kubernetesIds: ['payment-gateway'],
      repositories: ['acme/payment-gateway'],
      oncall: ['PABC123'],
      monitoring: ['https://app.datadoghq.com/dashboard/abc'],
      techdocsRef: 'dir:.',
      sourceLocation: 'url:https://github.com/acme/payment-gateway',
    });
  });

  it('returns empty handles for an entity without annotations', () => {
    expect(extractIntegrationReferences({})).toEqual({
      kubernetesIds: [],
      repositories: [],
      oncall: [],
      monitoring: [],
      techdocsRef: undefined,
      sourceLocation: undefined,
    });
  });
});

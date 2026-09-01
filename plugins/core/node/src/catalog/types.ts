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

/**
 * Compact, serializable view of a catalog entity suitable for AI agent
 * context. Deliberately smaller than a raw catalog entity: agents need
 * identity, ownership, lifecycle, and annotations, not the full document.
 */
export type CatalogEntitySummary = {
  /** Stringified entity reference, e.g. `component:default/payment-gateway`. */
  ref: string;
  kind: string;
  namespace: string;
  name: string;
  /** Human-readable display title, when set. */
  title?: string;
  /** Short entity description, when set. */
  description?: string;
  /** Entity type from `spec.type`, such as `service` or `website`. */
  type?: string;
  /** Lifecycle phase from `spec.lifecycle`, such as `production` or `deprecated`. */
  lifecycle?: string;
  /** Owning team or user reference from `spec.owner`. */
  owner?: string;
  /** Owning system reference from `spec.system`, when set. */
  system?: string;
  /** All entity annotations, preserved verbatim for integration discovery. */
  annotations: Record<string, string>;
  /** Entity tags from metadata. */
  tags: string[];
};

/**
 * A single directed relation edge from one entity to another.
 */
export type CatalogEntityRelation = {
  /** Relation type, such as `dependsOn`, `ownedBy`, or `providesApi`. */
  type: string;
  /** Stringified target entity reference. */
  targetRef: string;
};

/**
 * Bounded relation neighborhood around a root entity. Depth and total entity
 * count are capped by the resolver so traversal cannot fan out across the
 * entire catalog.
 */
export type CatalogRelationGraph = {
  /** Entity reference the traversal started from. */
  rootRef: string;
  /** Entities visited during traversal, keyed by entity reference. */
  entities: Record<string, CatalogEntitySummary>;
  /** Relation edges collected during traversal. */
  relations: CatalogEntityRelation[];
  /** True when the depth or entity budget cut traversal short. */
  truncated: boolean;
};

/**
 * Integration handles extracted from well-known entity annotations. Lets
 * agent workflows discover connected systems (Kubernetes, PagerDuty, source
 * repositories, TechDocs) without re-implementing annotation conventions.
 */
export type CatalogIntegrationReferences = {
  /** Values of `backstage.io/kubernetes-id` annotations. */
  kubernetesIds: string[];
  /** Source repository references, e.g. `github.com?repo=x&org=y` values. */
  repositories: string[];
  /** On-call provider references such as PagerDuty service/integration IDs. */
  oncall: string[];
  /** Monitoring/observability provider references. */
  monitoring: string[];
  /** TechDocs reference from `backstage.io/techdocs-ref`, when set. */
  techdocsRef?: string;
  /** Source location from `backstage.io/source-location`, when set. */
  sourceLocation?: string;
};

/**
 * Semantic, dependency-injected catalog query surface for AI agent workflows.
 *
 * This is the AI-facing catalog contract: bounded, compact, and oriented
 * around the questions agents actually ask (identity, annotation discovery,
 * relation neighborhoods, integration handles). Implementations adapt the
 * real Backstage catalog client; mapping rules live in pure functions so
 * they can be unit-tested without any catalog server.
 */
export interface CatalogEntityResolver {
  /**
   * Returns the summary for one entity reference, or `undefined` when the
   * entity does not exist or is not readable by the initiating identity.
   */
  getEntitySummary(
    entityRef: string,
  ): Promise<CatalogEntitySummary | undefined>;

  /**
   * Finds entities carrying a specific annotation value, optionally narrowed
   * by kind. Results are capped by `limit`.
   */
  findByAnnotation(input: {
    annotation: string;
    value: string;
    kinds?: string[];
    limit?: number;
  }): Promise<CatalogEntitySummary[]>;

  /**
   * Walks relation edges from a root entity, bounded by `maxDepth` hops and a
   * total `limit` of visited entities.
   */
  getRelations(input: {
    entityRef: string;
    relationTypes: string[];
    maxDepth: number;
    limit: number;
  }): Promise<CatalogRelationGraph>;

  /**
   * Extracts integration handles (Kubernetes IDs, repositories, on-call,
   * monitoring, TechDocs) from one entity's annotations.
   */
  getIntegrationReferences(
    entityRef: string,
  ): Promise<CatalogIntegrationReferences>;

  /**
   * Finds a user entity by email address, for org-graph identity mapping.
   * Returns `undefined` when no user matches (treated as an offboarded signal
   * by consumers, never an exception).
   */
  findUserByEmail(email: string): Promise<CatalogEntitySummary | undefined>;

  /**
   * Finds a single entity by a generic field/value pair. Useful when the
   * annotation helpers are too narrow (e.g. spec.profile.email).
   */
  findByField(input: {
    field: string;
    value: string;
    kinds?: string[];
  }): Promise<CatalogEntitySummary | undefined>;
}

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
/** Browser wire types mirroring the advisory guardrail backend. */
export type GuardrailRequest = { version: 1; source: 'manual' | 'preflight'; templateRef: string; parameters: Record<string, unknown>; environment?: string; requestedBy?: string; sessionId?: string };
export type EvaluateRequestInput = Omit<GuardrailRequest, 'version' | 'source'>;
export type EvidenceRef = { id: string; source: 'policy' | 'architecture' | 'cost' | 'knowledge'; summary: string; reference?: string };
export type PolicyViolation = { id: string; policyId?: string; rule: string; message: string; parameter?: string; severity: 'blocking' | 'negotiable' | 'advisory'; evidence: string[] };
export type BudgetVerdict = { status: 'within_budget' | 'over_budget' | 'undetermined'; currency?: string; amount?: number; ceiling?: number; thresholdUsd?: number; evidence: string[] };
export type MutationProposal = { id: string; parameter: string; from: unknown; to: unknown; resolves: string[]; projectedAmount?: number; rationale: string };
export type GuardrailAssessment = { templateRef: string; fingerprint: string; environment?: string; status: 'compliant' | 'negotiable' | 'escalate' | 'blocked' | 'undetermined' | 'resolved' | 'halted'; violations: PolicyViolation[]; budget?: BudgetVerdict; mutations: MutationProposal[]; confidence: 'high' | 'medium' | 'low'; limitations: string[]; evidence: EvidenceRef[] };
export type GuardrailResolution = { templateRef: string; fingerprint: string; outcome: 'accepted_mutation' | 'granted_exception' | 'halted'; approvedParameters?: Record<string, unknown>; acceptedMutations: string[]; assessmentRef: string; decidedBy: string; parameterHash: string };
export type ApprovalDecision = { status: 'approved' | 'rejected'; note?: string };
export type AiRunEvent =
  | { type: 'step'; data: { runId: string; seq: number; node: string; phase: 'enter' | 'exit' } }
  | { type: 'tool_call'; data: { runId: string; tool: string; args: unknown } }
  | { type: 'tool_result'; data: { runId: string; tool: string; ok: boolean; summary?: string } }
  | { type: 'approval_request'; data: { runId: string; approvalId: string; reason: string; effect: 'read' | 'write' } }
  | { type: 'artifact'; data: { runId: string; kind: string; ref?: string; url?: string } }
  | { type: 'done'; data: { runId: string } }
  | { type: 'error'; data: { runId: string; message: string } };

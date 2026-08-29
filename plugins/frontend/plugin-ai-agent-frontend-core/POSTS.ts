// @ts-nocheck

// plugins/frontend/plugin-ai-agent-frontend-alert-ai-tuner/src/api/client.ts

async *evaluateAlert(input: EvaluateAlertInput): AsyncGenerator<AiRunEvent> {
  const request: AlertTuningRequest = { version: 1, source: 'manual', ...input };

  yield* this.read(
    await this.fetchStream(`agents/${ALERT_TUNER_AGENT_ID}/runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await this.authHeaders())
      },
      body: JSON.stringify({ input: { query: JSON.stringify(request) } }),
    })
  );
}

async *submitApproval(runId: string, decision: ApprovalDecision): AsyncGenerator<AiRunEvent> {
  yield* this.read(
    await this.fetchStream(`runs/${runId}/approvals`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await this.authHeaders())
      },
      body: JSON.stringify(decision),
    })
  );
}

// plugins/frontend/plugin-ai-agent-frontend-catalog-ai-insights/src/api/client.ts

async *askQuestion(input: AskInsightInput): AsyncGenerator<AiRunEvent> {
  const { token } = await this.identityApi.getCredentials();
  const request: CatalogInsightRequest = {
    version: 1,
    source: 'manual',
    ...input,
  };
  const stream = await this.fetchSse(
    `agents/${CATALOG_AI_INSIGHTS_AGENT_ID}/runs`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        input: { query: JSON.stringify(request) },
      }),
    },
  );
  yield* this.readSse(stream);
}

// plugins/frontend/plugin-ai-agent-frontend-kubernetes-ai-responder/src/api/client.ts

  async *startInvestigation(input: ManualInvestigationInput) {
    // Pass false to wrapInQuery if the schema maps directly
    yield* this.executeAgentRun(KUBERNETES_AI_RESPONDER_AGENT_ID, input);
  }

// plugins/frontend/plugin-ai-agent-frontend-oncall-ai-handover-assistant/src/api/client.ts

async *compileBrief(input: Omit<HandoverRequest, 'version' | 'source'>): AsyncGenerator<AiRunEvent> {
  const { token } = await this.options.identityApi.getCredentials();
  const request: HandoverRequest = { version: 1, source: 'manual', ...input };

  yield* this.read(
    await this.response(`agents/${ONCALL_HANDOVER_AGENT_ID}/runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ input: { query: JSON.stringify(request) } }),
    })
  );
}

// plugins/frontend/plugin-ai-agent-frontend-release-notes-ai-generator/src/api/client.ts

export class ReleaseNotesClient extends BaseAiAgentClient {
  constructor(private readonly options: { identityApi: IdentityApi; fetchApi: FetchApi }) {
    super();
  }

  protected async getHeaders() {
    const { token } = await this.options.identityApi.getCredentials();
    return { authorization: `Bearer ${token}` };
  }

  // Refactored downstream methods to single expressions:
  async *generate(input: AgentInput<ReleaseNotesRequest>) {
    yield* this.executeAgentRun(RELEASE_NOTES_AGENT_ID, input);
  }

  async *submitApproval(runId: string, decision: ApprovalDecision) {
    yield* this.executeApprovalSubmit(runId, decision);
  }
}

// plugins/frontend/plugin-ai-agent-frontend-rfc-adr-ai-reviewer/src/api/client.ts

async *startReview(input: StartReviewInput): AsyncGenerator<AiRunEvent> {
  const request: ReviewRequest = { version: 1, source: 'manual', ...input };
  const stream = await this.fetchStream(
    `agents/${RFC_ADR_REVIEWER_AGENT_ID}/runs`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await this.authHeaders()),
      },
      body: JSON.stringify({ input: { query: JSON.stringify(request) } }),
    },
  );
  yield* this.read(stream);
}

async *submitApproval(
  runId: string,
  decision: ApprovalDecision,
): AsyncGenerator<AiRunEvent> {
  const stream = await this.fetchStream(`runs/${runId}/approvals`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(await this.authHeaders()),
    },
    body: JSON.stringify(decision),
  });
  yield* this.read(stream);
}

// plugins/frontend/plugin-ai-agent-frontend-scaffolder-ai-drift-detector/src/api/client.ts

async *checkDrift(input: CheckDriftInput): AsyncGenerator<AiRunEvent> {
  const request: DriftCheckRequest = { version: 1, source: 'manual', ...input };

  yield* this.read(
    await this.stream(`agents/${DRIFT_DETECTOR_AGENT_ID}/runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await this.headers())
      },
      body: JSON.stringify({ input: { query: JSON.stringify(request) } })
    })
  );
}

async *submitApproval(runId: string, decision: ApprovalDecision): AsyncGenerator<AiRunEvent> {
  yield* this.read(
    await this.stream(`runs/${runId}/approvals`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await this.headers())
      },
      body: JSON.stringify(decision)
    })
  );
}

// plugins/frontend/plugin-ai-agent-frontend-scaffolder-ai-infra/src/api/client.ts

async *previewGeneration(input: PreviewGenerationInput): AsyncGenerator<AiRunEvent> {
  const request: InfraGenerationRequest = { version: 1, source: 'manual', ...input };

  yield* this.read(
    await this.stream(`agents/${SCAFFOLDER_INFRA_AGENT_ID}/runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await this.headers())
      },
      body: JSON.stringify({ input: { query: JSON.stringify(request) } })
    })
  );
}

// plugins/frontend/plugin-ai-agent-frontend-scaffolder-ai-intent/src/api/client.ts

async *submitIntent(input: StartIntentInput): AsyncGenerator<AiRunEvent> {
  const request: IntentRequest = { version: 1, source: 'manual', ...input };

  yield* this.read(
    await this.fetchStream(`agents/${SCAFFOLDER_INTENT_AGENT_ID}/runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await this.authHeaders()),
      },
      body: JSON.stringify({ input: { query: JSON.stringify(request) } }),
    }),
  );
}

// plugins/frontend/plugin-ai-agent-frontend-scaffolder-ai-prd/src/api/client.ts

async *submitPrd(input: StartPrdInput): AsyncGenerator<AiRunEvent> {
  const request: PrdRequest = { version: 1, source: 'manual', ...input };
  yield* this.read(
    await this.fetchStream(`agents/${SCAFFOLDER_PRD_AGENT_ID}/runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await this.headers()),
      },
      body: JSON.stringify({ input: { query: JSON.stringify(request) } }),
    }),
  );
}

// plugins/frontend/plugin-ai-agent-frontend-scaffolder-ai-shadow-detective/src/api/client.ts

async *startScan(input: StartShadowScanInput): AsyncGenerator<AiRunEvent> {
  const request: ShadowScanRequest = {
    version: 1,
    source: 'manual',
    ...input,
  };

  yield* this.read(
    await this.fetchStream(`agents/${SHADOW_DETECTIVE_AGENT_ID}/runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await this.headers()),
      },
      body: JSON.stringify({ input: { query: JSON.stringify(request) } }),
    }),
  );
}

// plugins/frontend/plugin-ai-agent-frontend-search-ai-archeology/src/api/client.ts

async *startResearch(
  input: StartArcheologyInput,
): AsyncGenerator<AiRunEvent> {
  const request: ArcheologyRequest = {
    version: 1,
    source: 'manual',
    ...input,
  };
  yield* this.read(
    await this.fetchStream(`agents/${SEARCH_ARCHEOLOGY_AGENT_ID}/runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await this.authHeaders()),
      },
      body: JSON.stringify({ input: { query: JSON.stringify(request) } }),
    }),
  );
}

// plugins/frontend/plugin-ai-agent-frontend-search-ai-context/src/api/client.ts

async *startAssessment(input: StartImpactInput): AsyncGenerator<AiRunEvent> {
  const request: ImpactRequest = { version: 1, source: 'manual', ...input };

  yield* this.read(
    await this.fetchStream(`agents/${SEARCH_CONTEXT_AGENT_ID}/runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await this.authHeaders()),
      },
      body: JSON.stringify({ input: { query: JSON.stringify(request) } }),
    }),
  );
}

async *streamRunEvents(runId: string): AsyncGenerator<AiRunEvent> {
  yield* this.read(
    await this.fetchStream(`runs/${runId}/events`, {
      method: 'GET',
      headers: await this.authHeaders(),
    }),
  );
}

// plugins/frontend/plugin-ai-agent-frontend-tech-debt-ai-scout/src/api/client.ts

async *startScan(input: StartDebtScanInput): AsyncGenerator<AiRunEvent> {
  const request: DebtScoutRequest = {
    version: 1,
    source: 'manual',
    ...input,
  };

  yield* this.read(
    await this.fetchStream(`agents/${TECH_DEBT_SCOUT_AGENT_ID}/runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await this.authHeaders()),
      },
      body: JSON.stringify({ input: { query: JSON.stringify(request) } }),
    }),
  );
}

// plugins/frontend/plugin-ai-agent-frontend-tech-radar-ai-manager/src/api/client.ts

async *startAnalysis(input: StartRadarScanInput): AsyncGenerator<AiRunEvent> {
  const request: RadarScanRequest = {
    version: 1,
    source: 'manual',
    ...input,
  };

  yield* this.read(
    await this.fetchStream(`agents/${TECH_RADAR_AGENT_ID}/runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await this.authHeaders()),
      },
      body: JSON.stringify({ input: { query: JSON.stringify(request) } }),
    }),
  );
}

// plugins/frontend/plugin-ai-agent-frontend-techdocs-ai-janitor/src/api/client.ts

async *startAudit(input: StartJanitorInput): AsyncGenerator<AiRunEvent> {
  const request: JanitorRequest = { version: 1, source: 'manual', ...input };

  yield* this.read(
    await this.fetchStream(`agents/${TECHDOCS_JANITOR_AGENT_ID}/runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await this.authHeaders()),
      },
      body: JSON.stringify({ input: { query: JSON.stringify(request) } }),
    }),
  );
}

// plugins/frontend/plugin-ai-agent-frontend-techdocs-ai-postmortem/src/api/client.ts

async *startDraft(incidentId: string): AsyncGenerator<AiRunEvent> {
  const request: PostmortemRequest = {
    version: 1,
    source: 'manual',
    incidentId,
  };

  yield* this.read(
    await this.fetchStream(`agents/${TECHDOCS_POSTMORTEM_AGENT_ID}/runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await this.authHeaders()),
      },
      body: JSON.stringify({ input: { query: JSON.stringify(request) } }),
    }),
  );
}

// @ts-nocheck

// plugins/frontend/plugin-ai-agent-frontend-alert-ai-tuner/src/api/client.ts

async *streamRunEvents(runId: string, lastEventId?: number): AsyncGenerator<AiRunEvent> {
  yield* this.read(
    await this.fetchStream(`runs/${runId}/events`, {
      method: 'GET',
      headers: {
        ...(await this.authHeaders()),
        ...(lastEventId === undefined ? {} : { 'Last-Event-ID': String(lastEventId) }),
      },
    })
  );
}

// plugins/frontend/plugin-ai-agent-frontend-catalog-ai-insights/src/api/client.ts

async *streamRunEvents(
  runId: string,
  lastEventId?: number,
): AsyncGenerator<AiRunEvent> {
  const { token } = await this.identityApi.getCredentials();
  const stream = await this.fetchSse(`runs/${runId}/events`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(typeof lastEventId === 'number'
        ? { 'Last-Event-ID': String(lastEventId) }
        : {}),
    },
  });
  yield* this.readSse(stream);
}


// plugins/frontend/plugin-ai-agent-frontend-kubernetes-ai-responder/src/api/client.ts

async *streamRunEvents(
  runId: string,
  lastEventId?: number,
): AsyncGenerator<AiRunEvent> {
  const { token } = await this.identityApi.getCredentials();
  const stream = await this.fetchSse(`runs/${runId}/events`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(typeof lastEventId === 'number'
        ? { 'Last-Event-ID': String(lastEventId) }
        : {}),
    },
  });
  yield* this.readSse(stream);
}

// plugins/frontend/plugin-ai-agent-frontend-oncall-ai-handover-assistant/src/api/client.ts

async *streamRunEvents(runId: string, lastEventId?: number): AsyncGenerator<AiRunEvent> {
  const { token } = await this.options.identityApi.getCredentials();
  yield* this.read(
    await this.response(`runs/${runId}/events`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        ...(lastEventId === undefined ? {} : { 'Last-Event-ID': String(lastEventId) }),
      },
    })
  );
}

// plugins/frontend/plugin-ai-agent-frontend-release-notes-ai-generator/src/api/client.ts

async *streamRunEvents(runId: string, lastEventId?: number): AsyncGenerator<AiRunEvent> {
  const { token } = await this.options.identityApi.getCredentials();

  yield* this.read(
    await this.fetchStream(`runs/${runId}/events`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        ...(lastEventId === undefined ? {} : { 'Last-Event-ID': String(lastEventId) })
      }
    })
  );
}

// plugins/frontend/plugin-ai-agent-frontend-rfc-adr-ai-reviewer/src/api/client.ts

async *streamRunEvents(
  runId: string,
  lastEventId?: number,
): AsyncGenerator<AiRunEvent> {
  const stream = await this.fetchStream(`runs/${runId}/events`, {
    method: 'GET',
    headers: {
      ...(await this.authHeaders()),
      ...(typeof lastEventId === 'number'
        ? { 'Last-Event-ID': String(lastEventId) }
        : {}),
    },
  });
  yield* this.read(stream);
}

// plugins/frontend/plugin-ai-agent-frontend-scaffolder-ai-drift-detector/src/api/client.ts

async *streamRunEvents(runId: string, lastEventId?: number): AsyncGenerator<AiRunEvent> {
  yield* this.read(
    await this.stream(`runs/${runId}/events`, {
      method: 'GET',
      headers: {
        ...(await this.headers()),
        ...(lastEventId === undefined ? {} : { 'Last-Event-ID': String(lastEventId) })
      }
    })
  );
}

// plugins/frontend/plugin-ai-agent-frontend-scaffolder-ai-infra/src/api/client.ts

/** Connects to historical run channels, passing optional event offsets for seamless crash recovery. */
async *streamRunEvents(runId: string, lastEventId?: number): AsyncGenerator<AiRunEvent> {
  yield* this.read(
    await this.stream(`runs/${runId}/events`, {
      method: 'GET',
      headers: {
        ...(await this.headers()),
        ...(lastEventId === undefined ? {} : { 'Last-Event-ID': String(lastEventId) })
      }
    })
  );
}


// plugins/frontend/plugin-ai-agent-frontend-scaffolder-ai-intent/src/api/client.ts

async *streamRunEvents(runId: string): AsyncGenerator<AiRunEvent> {
  yield* this.read(
    await this.fetchStream(`runs/${runId}/events`, {
      method: 'GET',
      headers: await this.authHeaders(),
    }),
  );
}


// plugins/frontend/plugin-ai-agent-frontend-scaffolder-ai-prd/src/api/client.ts

async *streamRunEvents(runId: string): AsyncGenerator<AiRunEvent> {
  yield* this.read(
    await this.fetchStream(`runs/${runId}/events`, {
      method: 'GET',
      headers: await this.headers(),
    }),
  );
}

// plugins/frontend/plugin-ai-agent-frontend-scaffolder-ai-shadow-detective/src/api/client.ts

async *streamRunEvents(runId: string): AsyncGenerator<AiRunEvent> {
  yield* this.read(
    await this.fetchStream(`runs/${runId}/events`, {
      method: 'GET',
      headers: await this.headers(),
    }),
  );
}

// plugins/frontend/plugin-ai-agent-frontend-search-ai-archeology/src/api/client.ts

async *streamRunEvents(runId: string): AsyncGenerator<AiRunEvent> {
  yield* this.read(
    await this.fetchStream(`runs/${runId}/events`, {
      method: 'GET',
      headers: await this.authHeaders(),
    }),
  );
}

// plugins/frontend/plugin-ai-agent-frontend-search-ai-context/src/api/client.ts

async *streamRunEvents(runId: string): AsyncGenerator<AiRunEvent> {
  yield* this.read(
    await this.fetchStream(`runs/${runId}/events`, {
      method: 'GET',
      headers: await this.authHeaders(),
    }),
  );
}

// plugins/frontend/plugin-ai-agent-frontend-tech-debt-ai-scout/src/api/client.ts

async *streamRunEvents(runId: string): AsyncGenerator<AiRunEvent> {
  yield* this.read(
    await this.fetchStream(`runs/${runId}/events`, {
      method: 'GET',
      headers: await this.authHeaders(),
    }),
  );
}

// plugins/frontend/plugin-ai-agent-frontend-tech-radar-ai-manager/src/api/client.ts

async *streamRunEvents(runId: string): AsyncGenerator<AiRunEvent> {
  yield* this.read(
    await this.fetchStream(`runs/${runId}/events`, {
      method: 'GET',
      headers: await this.authHeaders(),
    }),
  );
}

// plugins/frontend/plugin-ai-agent-frontend-techdocs-ai-janitor/src/api/client.ts

async *streamRunEvents(runId: string): AsyncGenerator<AiRunEvent> {
  yield* this.read(
    await this.fetchStream(`runs/${runId}/events`, {
      method: 'GET',
      headers: await this.authHeaders(),
    }),
  );
}

// plugins/frontend/plugin-ai-agent-frontend-techdocs-ai-postmortem/src/api/client.ts

async *streamRunEvents(runId: string): AsyncGenerator<AiRunEvent> {
  yield* this.read(
    await this.fetchStream(`runs/${runId}/events`, {
      method: 'GET',
      headers: await this.authHeaders(),
    }),
  );
}

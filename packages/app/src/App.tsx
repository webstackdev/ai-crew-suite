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
import { createApp } from '@backstage/frontend-defaults';
import type { FrontendFeature } from '@backstage/frontend-plugin-api';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import notificationsPlugin from '@backstage/plugin-notifications/alpha';
import searchPlugin from '@backstage/plugin-search/alpha';
import ragAiPlugin from '@webstackbuilders/plugin-ai-crew-suite/alpha';
import kubernetesAiResponderPlugin from '@webstackbuilders/plugin-ai-agent-frontend-kubernetes-ai-responder/alpha';
import oncallHandoverPlugin from '@webstackbuilders/plugin-ai-agent-frontend-oncall-ai-handover-assistant/alpha';
import releaseNotesPlugin from '@webstackbuilders/plugin-ai-agent-frontend-release-notes-ai-generator/alpha';
import alertAiTunerPlugin from '@webstackbuilders/plugin-ai-agent-frontend-alert-ai-tuner/alpha';
import driftDetectorPlugin from '@webstackbuilders/plugin-ai-agent-frontend-scaffolder-ai-drift-detector/alpha';
import scaffolderGuardrailPlugin from '@webstackbuilders/plugin-ai-agent-frontend-scaffolder-ai-guardrail-agent/alpha';
import scaffolderInfraPlugin from '@webstackbuilders/plugin-ai-agent-frontend-scaffolder-ai-infra/alpha';
import catalogAiInsightsPlugin from '@webstackbuilders/plugin-ai-agent-frontend-catalog-ai-insights/alpha';
import rfcAdrReviewerPlugin from '@webstackbuilders/plugin-ai-agent-frontend-rfc-adr-ai-reviewer/alpha';
import searchArcheologyPlugin from '@webstackbuilders/plugin-ai-agent-frontend-search-ai-archeology/alpha';
import techDebtScoutPlugin from '@webstackbuilders/plugin-ai-agent-frontend-tech-debt-ai-scout/alpha';
import techRadarPlugin from '@webstackbuilders/plugin-ai-agent-frontend-tech-radar-ai-manager/alpha';
import techdocsJanitorPlugin from '@webstackbuilders/plugin-ai-agent-frontend-techdocs-ai-janitor/alpha';
import techdocsPostmortemPlugin from '@webstackbuilders/plugin-ai-agent-frontend-techdocs-ai-postmortem/alpha';
import { navModule } from './modules/nav';

const features: FrontendFeature[] = [
  catalogPlugin as FrontendFeature,
  notificationsPlugin as FrontendFeature,
  searchPlugin as FrontendFeature,
  navModule as FrontendFeature,
  ragAiPlugin,
  kubernetesAiResponderPlugin,
  oncallHandoverPlugin,
  releaseNotesPlugin,
  catalogAiInsightsPlugin,
  alertAiTunerPlugin,
  driftDetectorPlugin,
  scaffolderGuardrailPlugin,
  scaffolderInfraPlugin,
  rfcAdrReviewerPlugin,
  searchArcheologyPlugin,
  techDebtScoutPlugin,
  techRadarPlugin,
  techdocsJanitorPlugin,
  techdocsPostmortemPlugin,
];

const app = createApp({
  features,
});

export default app.createRoot();

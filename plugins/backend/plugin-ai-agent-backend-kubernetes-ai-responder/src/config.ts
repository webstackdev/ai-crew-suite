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
import { Config } from '@backstage/config';

export type KubernetesAiResponderConfig = {
  modelRef: string;
  maxEvidenceItems: number;
  maxLogBytes: number;
  lookbackMinutes: number;
  maxToolInvocations: number;
};

export const readKubernetesAiResponderConfig = (
  config: Config,
): KubernetesAiResponderConfig => {
  const section = config.getOptionalConfig('ai.agents.kubernetesAiResponder');
  if (!section) {
    throw new Error(
      'Kubernetes AI responder requires ai.agents.kubernetesAiResponder configuration to be set',
    );
  }

  return {
    modelRef: section.getString('model'),
    maxEvidenceItems: section.getOptionalNumber('maxEvidenceItems') ?? 20,
    maxLogBytes: section.getOptionalNumber('maxLogBytes') ?? 16_384,
    lookbackMinutes: section.getOptionalNumber('lookbackMinutes') ?? 30,
    maxToolInvocations: section.getOptionalNumber('maxToolInvocations') ?? 12,
  };
};

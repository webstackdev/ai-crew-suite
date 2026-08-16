import { mockServices } from '@backstage/backend-test-utils';
import { describe, expect, it } from 'vitest';
import { readKubernetesConfig } from '../config';

const configWith = (data: object) => mockServices.rootConfig({ data });

describe('readKubernetesConfig', () => {
  it('reads the diagnostics driver identifier', () => {
    expect(
      readKubernetesConfig(
        configWith({ ai: { integrations: { kubernetes: { provider: 'backstage' } } } }),
      ),
    ).toEqual({ provider: 'backstage' });
  });

  it('throws when the Kubernetes section is missing', () => {
    expect(() => readKubernetesConfig(configWith({}))).toThrow(
      /requires ai.integrations.kubernetes configuration/,
    );
  });

  it('throws when the driver identifier is missing', () => {
    expect(() =>
      readKubernetesConfig(
        configWith({ ai: { integrations: { kubernetes: {} } } }),
      ),
    ).toThrow(/ai.integrations.kubernetes.provider/);
  });
});

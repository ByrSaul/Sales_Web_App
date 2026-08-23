import { describe, expect, it } from 'vitest';
import { getConfigurationErrors, type AppConfig } from './env';

const config = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  apiBaseUrl: '/api',
  authMode: 'msal',
  devAccessToken: '',
  tenantId: 'tenant',
  clientId: 'client',
  scope: 'scope',
  featureProduction: false,
  featureForecast: false,
  ...overrides,
});

describe('authentication configuration', () => {
  it('keeps MSAL structurally available', () =>
    expect(getConfigurationErrors(config(), false)).toEqual([]));
  it('requires a token when dev-token mode is selected', () =>
    expect(getConfigurationErrors(config({ authMode: 'dev-token' }), false)).toContain(
      'VITE_DEV_ACCESS_TOKEN',
    ));
  it('rejects dev-token mode in production even when a token exists', () =>
    expect(
      getConfigurationErrors(
        config({ authMode: 'dev-token', devAccessToken: 'configured-at-runtime' }),
        true,
      ),
    ).toContain('VITE_AUTH_MODE=dev-token no está permitido en producción'));
});

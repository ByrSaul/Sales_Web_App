/** Configuración de ejecución obtenida desde variables públicas de Vite. */
export type AppConfig = {
  apiBaseUrl: string;
  authMode: 'msal' | 'dev-token' | 'e2e-mock';
  devAccessToken: string;
  tenantId: string;
  clientId: string;
  scope: string;
  featureProduction: boolean;
  featureForecast: boolean;
};

const read = (key: string): string => (import.meta.env[key] as string | undefined)?.trim() ?? '';
// Fail closed: only the literal string "true" enables a feature; anything else (missing,
// "false", typo) keeps it disabled.
const flag = (key: string): boolean => read(key) === 'true';

const e2e = import.meta.env.MODE === 'e2e';
export const appConfig: AppConfig = {
  apiBaseUrl: (e2e ? 'http://127.0.0.1:4173/api' : read('VITE_API_BASE_URL')).replace(/\/$/, ''),
  authMode: e2e ? 'e2e-mock' : read('VITE_AUTH_MODE') === 'dev-token' ? 'dev-token' : 'msal',
  devAccessToken: read('VITE_DEV_ACCESS_TOKEN'),
  tenantId: read('VITE_AZURE_TENANT_ID'),
  clientId: read('VITE_AZURE_CLIENT_ID'),
  scope: read('VITE_AZURE_SCOPE'),
  featureProduction: flag('VITE_FEATURE_PRODUCTION'),
  featureForecast: flag('VITE_FEATURE_FORECAST'),
};

/** Valida las variables obligatorias para la estrategia de autenticación activa. */
export const getConfigurationErrors = (
  config = appConfig,
  production = import.meta.env.PROD,
): string[] => {
  const missing: string[] = [];
  if (!config.apiBaseUrl) missing.push('VITE_API_BASE_URL');
  if (config.authMode === 'dev-token') {
    if (production) missing.push('VITE_AUTH_MODE=dev-token no está permitido en producción');
    if (!config.devAccessToken) missing.push('VITE_DEV_ACCESS_TOKEN');
  } else if (config.authMode === 'msal') {
    if (!config.tenantId) missing.push('VITE_AZURE_TENANT_ID');
    if (!config.clientId) missing.push('VITE_AZURE_CLIENT_ID');
    if (!config.scope) missing.push('VITE_AZURE_SCOPE');
  }
  return missing;
};

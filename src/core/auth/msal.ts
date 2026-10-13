import { BrowserCacheLocation, PublicClientApplication } from '@azure/msal-browser';
import { appConfig } from '../../app/config/env';

/** Solicitud de autenticación construida con el scope configurado para el API. */
export const loginRequest = { scopes: [appConfig.scope].filter(Boolean) };

/** Cliente MSAL compartido por el proveedor de autenticación. */
export const msalInstance = new PublicClientApplication({
  auth: {
    clientId: appConfig.clientId || '00000000-0000-0000-0000-000000000000',
    authority: `https://login.microsoftonline.com/${appConfig.tenantId || 'common'}`,
    // Redirect URI SPA registrada en Entra ID; la sirve auth/redirect.html (redirect bridge).
    redirectUri: `${window.location.origin}/auth/redirect.html`,
    postLogoutRedirectUri: `${window.location.origin}/auth/redirect.html`,
  },
  cache: {
    cacheLocation: BrowserCacheLocation.SessionStorage,
  },
});

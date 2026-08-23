import { BrowserCacheLocation, PublicClientApplication } from '@azure/msal-browser';
import { appConfig } from '../../app/config/env';

export const loginRequest = { scopes: [appConfig.scope].filter(Boolean) };

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId: appConfig.clientId || '00000000-0000-0000-0000-000000000000',
    authority: `https://login.microsoftonline.com/${appConfig.tenantId || 'common'}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: `${window.location.origin}/login`,
  },
  cache: {
    cacheLocation: BrowserCacheLocation.SessionStorage,
  },
});

import {
  InteractionRequiredAuthError,
  type AccountInfo,
  type PublicClientApplication,
} from '@azure/msal-browser';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { loginRequest } from '../../core/auth/msal';
import {
  createDevTokenProvider,
  devAccountId,
  DevTokenConfigurationError,
} from '../../core/auth/devToken';
import { appConfig } from '../config/env';
import { ApiError } from '../../core/api/errors';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
type AuthAccount = Pick<AccountInfo, 'homeAccountId'> &
  Partial<Pick<AccountInfo, 'name' | 'username'>>;
type AuthContextValue = {
  mode: 'msal' | 'dev-token' | 'e2e-mock';
  status: AuthStatus;
  account: AuthAccount | null;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: (forceRefresh?: boolean) => Promise<string>;
  canRefreshToken: boolean;
  unauthorized: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Proveedor del estado de autenticación y del token consumido por el API.
 *
 * Flujo:
 * - Inicializa la estrategia MSAL o de desarrollo.
 * - Restaura la cuenta autenticada.
 * - Expone login, logout y adquisición de tokens.
 */
export const AuthProvider = ({
  instance,
  children,
}: {
  instance: PublicClientApplication;
  children: ReactNode;
}) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activateAccount = useCallback(
    (next: AuthAccount | null) => {
      if (appConfig.authMode === 'msal') instance.setActiveAccount(next as AccountInfo | null);
      setAccount(next);
      setStatus(next ? 'authenticated' : 'unauthenticated');
    },
    [instance],
  );
  const activateDevToken = useCallback(() => {
    try {
      setError(null);
      activateAccount({ homeAccountId: devAccountId(appConfig.devAccessToken) });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Configuración de token de desarrollo inválida.',
      );
      setStatus('unauthenticated');
    }
  }, [activateAccount]);
  useEffect(() => {
    if (appConfig.authMode === 'e2e-mock') {
      activateAccount({ homeAccountId: 'e2e-mock-account' });
      return;
    }
    if (appConfig.authMode === 'dev-token') {
      activateDevToken();
      return;
    }
    activateAccount(instance.getActiveAccount() ?? instance.getAllAccounts()[0] ?? null);
  }, [activateAccount, activateDevToken, instance]);
  const login = useCallback(async () => {
    setError(null);
    setStatus('loading');
    if (appConfig.authMode === 'e2e-mock') {
      activateAccount({ homeAccountId: 'e2e-mock-account' });
      return;
    }
    if (appConfig.authMode === 'dev-token') {
      activateDevToken();
      return;
    }
    try {
      const result = await instance.loginPopup(loginRequest);
      activateAccount(result.account);
    } catch {
      setError('No fue posible iniciar sesión con Microsoft.');
      setStatus('unauthenticated');
    }
  }, [activateAccount, activateDevToken, instance]);
  const getAccessToken = useCallback(
    async (forceRefresh = false): Promise<string> => {
      if (appConfig.authMode === 'e2e-mock') return 'controlled-e2e-authorization';
      if (appConfig.authMode === 'dev-token') {
        try {
          return await createDevTokenProvider(appConfig.devAccessToken)();
        } catch (cause) {
          if (cause instanceof DevTokenConfigurationError)
            throw new ApiError(cause.kind, cause.message);
          throw cause;
        }
      }
      const current = instance.getActiveAccount() ?? (account as AccountInfo | null);
      if (!current) throw new Error('No authenticated account');
      try {
        return (
          await instance.acquireTokenSilent({ ...loginRequest, account: current, forceRefresh })
        ).accessToken;
      } catch (cause) {
        if (cause instanceof InteractionRequiredAuthError) {
          const result = await instance.acquireTokenPopup({ ...loginRequest, account: current });
          activateAccount(result.account);
          return result.accessToken;
        }
        throw cause;
      }
    },
    [account, activateAccount, instance],
  );
  const logout = useCallback(async () => {
    if (appConfig.authMode === 'e2e-mock') {
      activateAccount(null);
      return;
    }
    if (appConfig.authMode === 'dev-token') {
      activateAccount(null);
      return;
    }
    const current = instance.getActiveAccount() ?? (account as AccountInfo | null);
    activateAccount(null);
    await instance.logoutPopup({
      account: current ?? undefined,
      postLogoutRedirectUri: `${window.location.origin}/login`,
    });
  }, [account, activateAccount, instance]);
  const unauthorized = useCallback(async () => {
    if (appConfig.authMode !== 'msal') {
      setError(
        'El token de desarrollo fue rechazado o puede haber expirado. Actualice VITE_DEV_ACCESS_TOKEN y reinicie la aplicación.',
      );
      setStatus('unauthenticated');
      return;
    }
    await logout();
  }, [logout]);
  const value = useMemo(
    () => ({
      mode: appConfig.authMode,
      status,
      account,
      error,
      login,
      logout,
      getAccessToken,
      canRefreshToken: appConfig.authMode === 'msal',
      unauthorized,
    }),
    [status, account, error, login, logout, getAccessToken, unauthorized],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
/** @returns Contexto de autenticación disponible dentro de `AuthProvider`. */
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};

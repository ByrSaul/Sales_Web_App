import { act, cleanup, renderHook } from '@testing-library/react';
import {
  AuthError,
  BrowserAuthErrorCodes,
  InteractionRequiredAuthError,
  type PublicClientApplication,
} from '@azure/msal-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthProvider';
const config = vi.hoisted(() => ({
  authMode: 'msal' as 'msal' | 'dev-token' | 'e2e-mock',
  devAccessToken: '',
}));
vi.mock('../config/env', () => ({ appConfig: config }));
vi.mock('../../core/auth/msal', () => ({ loginRequest: { scopes: ['api/.default'] } }));
const account = { homeAccountId: 'A1', username: 'user@example.test', name: 'Usuario' };
const api = () => ({
  getActiveAccount: vi.fn().mockReturnValue(account),
  getAllAccounts: vi.fn().mockReturnValue([]),
  setActiveAccount: vi.fn(),
  loginPopup: vi.fn().mockResolvedValue({ account }),
  acquireTokenSilent: vi.fn().mockResolvedValue({ accessToken: 'silent-test-token' }),
  acquireTokenPopup: vi.fn().mockResolvedValue({ account, accessToken: 'interactive-test-token' }),
  logoutPopup: vi.fn().mockResolvedValue(undefined),
});
const mount = (instance = api()) => ({
  instance,
  ...renderHook(useAuth, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <AuthProvider instance={instance as unknown as PublicClientApplication}>
        {children}
      </AuthProvider>
    ),
  }),
});
beforeEach(() => {
  config.authMode = 'msal';
  config.devAccessToken = '';
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MSAL authentication lifecycle', () => {
  it('restores an active account and exposes refresh capability', () => {
    const { result, instance } = mount();
    expect(result.current.status).toBe('authenticated');
    expect(result.current.account).toEqual(account);
    expect(result.current.canRefreshToken).toBe(true);
    expect(instance.setActiveAccount).toHaveBeenCalledWith(account);
  });
  it.each([true, false])('restores the first cached account only when available (%s)', (cached) => {
    const instance = api();
    instance.getActiveAccount.mockReturnValue(null);
    instance.getAllAccounts.mockReturnValue(cached ? [account] : []);
    const { result } = mount(instance);
    expect(result.current.status).toBe(cached ? 'authenticated' : 'unauthenticated');
    expect(result.current.account).toEqual(cached ? account : null);
  });
  it('waits for login, activates the returned account and clears loading', async () => {
    const instance = api();
    instance.getActiveAccount.mockReturnValue(null);
    let release!: (value: { account: typeof account }) => void;
    instance.loginPopup.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const { result } = mount(instance);
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.login();
    });
    expect(result.current.status).toBe('loading');
    await act(async () => {
      release({ account });
      await pending;
    });
    expect(result.current.status).toBe('authenticated');
    expect(instance.loginPopup).toHaveBeenCalledExactlyOnceWith({ scopes: ['api/.default'] });
  });
  it.each([BrowserAuthErrorCodes.userCancelled, 'popup_window_error', 'unexpected'])(
    'reports login failure %s without exposing the request detail',
    async (code) => {
      const instance = api();
      const failure =
        code === 'unexpected' ? new Error('secret request') : new AuthError(code, 'secret request');
      instance.loginPopup.mockRejectedValue(failure);
      const { result } = mount(instance);
      await act(async () => {
        await result.current.login();
      });
      expect(result.current.status).toBe('unauthenticated');
      expect(result.current.error).not.toContain('secret request');
      if (code === BrowserAuthErrorCodes.userCancelled)
        expect(result.current.error).toBe('Inicio de sesión cancelado.');
      else expect(result.current.error).toContain('No fue posible iniciar sesión con Microsoft');
      expect(instance.loginPopup).toHaveBeenCalledTimes(1);
    },
  );
  it('passes forceRefresh and the current account into silent acquisition', async () => {
    const { result, instance } = mount();
    await expect(result.current.getAccessToken()).resolves.toBe('silent-test-token');
    await expect(result.current.getAccessToken(true)).resolves.toBe('silent-test-token');
    expect(instance.acquireTokenSilent).toHaveBeenLastCalledWith({
      scopes: ['api/.default'],
      account,
      forceRefresh: true,
    });
    expect(instance.acquireTokenPopup).not.toHaveBeenCalled();
  });
  it('falls back to the context account if MSAL no longer exposes an active account', async () => {
    const { result, instance } = mount();
    instance.getActiveAccount.mockReturnValue(null);
    await expect(result.current.getAccessToken()).resolves.toBe('silent-test-token');
    expect(instance.acquireTokenSilent.mock.calls[0][0].account).toEqual(account);
  });
  it('uses one interactive acquisition only for interaction-required failures', async () => {
    const instance = api();
    instance.acquireTokenSilent.mockRejectedValue(
      new InteractionRequiredAuthError('interaction_required', 'interaction required'),
    );
    const { result } = mount(instance);
    let token = '';
    await act(async () => {
      token = await result.current.getAccessToken();
    });
    expect(token).toBe('interactive-test-token');
    expect(instance.acquireTokenPopup).toHaveBeenCalledExactlyOnceWith({
      scopes: ['api/.default'],
      account,
    });
    expect(result.current.status).toBe('authenticated');
  });
  it('propagates an unexpected token failure without an interactive retry', async () => {
    const instance = api();
    const failure = new Error('offline');
    instance.acquireTokenSilent.mockRejectedValue(failure);
    const { result } = mount(instance);
    await expect(result.current.getAccessToken()).rejects.toBe(failure);
    expect(instance.acquireTokenPopup).not.toHaveBeenCalled();
  });
  it('rejects token acquisition without an account before contacting MSAL', async () => {
    const instance = api();
    instance.getActiveAccount.mockReturnValue(null);
    const { result } = mount(instance);
    await expect(result.current.getAccessToken()).rejects.toThrow('No authenticated account');
    expect(instance.acquireTokenSilent).not.toHaveBeenCalled();
  });
  it('clears identity on unauthorized and waits for logout', async () => {
    const { result, instance } = mount();
    await act(async () => {
      await result.current.unauthorized();
    });
    expect(result.current.account).toBeNull();
    expect(result.current.status).toBe('unauthenticated');
    expect(instance.logoutPopup).toHaveBeenCalledExactlyOnceWith({ account });
  });
  it('propagates a logout rejection after clearing local identity, without retrying', async () => {
    const instance = api();
    instance.getActiveAccount.mockReturnValue(null);
    instance.logoutPopup.mockRejectedValue(new Error('logout failed'));
    const { result } = mount(instance);
    await act(async () => {
      await expect(result.current.logout()).rejects.toThrow('logout failed');
    });
    expect(result.current.account).toBeNull();
    expect(instance.logoutPopup).toHaveBeenCalledExactlyOnceWith({ account: undefined });
  });
});

describe('explicit nonproduction authentication modes', () => {
  it('provides controlled e2e identity and token without MSAL interactions', async () => {
    config.authMode = 'e2e-mock';
    const { result, instance } = mount();
    expect(result.current.account?.homeAccountId).toBe('e2e-mock-account');
    expect(result.current.canRefreshToken).toBe(false);
    await expect(result.current.getAccessToken()).resolves.toBe('controlled-e2e-authorization');
    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.account).toBeNull();
    await act(async () => {
      await result.current.login();
    });
    expect(result.current.status).toBe('authenticated');
    expect(instance.loginPopup).not.toHaveBeenCalled();
    expect(instance.logoutPopup).not.toHaveBeenCalled();
    expect(instance.setActiveAccount).not.toHaveBeenCalled();
  });
  it('restores a dev-token identity, returns the configured token and clears it on logout', async () => {
    config.authMode = 'dev-token';
    config.devAccessToken =
      'header.' + btoa(JSON.stringify({ oid: 'fixture-user' })) + '.signature';
    const { result, instance } = mount();
    expect(result.current.account?.homeAccountId).toBe('dev-token:fixture-user');
    expect(result.current.canRefreshToken).toBe(false);
    await expect(result.current.getAccessToken()).resolves.toBe(config.devAccessToken);
    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.status).toBe('unauthenticated');
    await act(async () => {
      await result.current.login();
    });
    expect(result.current.status).toBe('authenticated');
    await act(async () => {
      await result.current.unauthorized();
    });
    expect(result.current.error).toContain('fue rechazado');
    expect(result.current.status).toBe('unauthenticated');
    expect(instance.acquireTokenSilent).not.toHaveBeenCalled();
    expect(instance.logoutPopup).not.toHaveBeenCalled();
  });
  it('reports invalid dev-token configuration and maps token failures to typed API errors', async () => {
    config.authMode = 'dev-token';
    const { result } = mount();
    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.error).toContain('no está configurado');
    await expect(result.current.getAccessToken()).rejects.toMatchObject({ kind: 'configuration' });
    await act(async () => {
      await result.current.login();
    });
    expect(result.current.status).toBe('unauthenticated');
  });
});

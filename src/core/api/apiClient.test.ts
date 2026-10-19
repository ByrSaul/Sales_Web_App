import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from './apiClient';
import { ApiError } from './errors';

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
describe('ApiClient', () => {
  it.each([
    [403, '{}', 'forbidden'],
    [500, '{"detail":"backend detail"}', 'backend'],
    [502, 'not JSON', 'backend'],
    [200, 'not JSON', 'invalid-response'],
  ])('classifies status %s and response %s without retrying', async (status, body, kind) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status }));
    const api = new ApiClient({ baseUrl: '/api', getToken: async () => 'token', onUnauthorized: vi.fn(), fetchImpl });
    await expect(api.get('/test')).rejects.toMatchObject({ kind, status });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('accepts an empty 204 response and preserves PATCH serialization', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const api = new ApiClient({ baseUrl: '/api', getToken: async () => 'token', onUnauthorized: vi.fn(), fetchImpl });
    await expect(api.patch('/test', { quantity: 2 })).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledWith('/api/test', expect.objectContaining({ method: 'PATCH', body: '{"quantity":2}' }));
  });

  it.each([
    [new DOMException('aborted', 'AbortError'), 'timeout'],
    [new TypeError('fetch failed'), 'network'],
    [new Error('unexpected'), 'unknown'],
  ])('classifies a transport failure as %s', async (error, kind) => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(error);
    const api = new ApiClient({ baseUrl: '/api', getToken: async () => 'token', onUnauthorized: vi.fn(), fetchImpl });
    await expect(api.post('/test', { value: 1 })).rejects.toMatchObject({ kind });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('handles a failed refresh without starting a second request', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 401));
    const api = new ApiClient({ baseUrl: '/api', getToken: async (force) => {
      if (force) throw new ApiError('authentication', 'expired');
      return 'token';
    }, onUnauthorized: vi.fn(), fetchImpl });
    await expect(api.get('/test')).rejects.toMatchObject({ kind: 'authentication' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('adds the bearer token', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ok: true }));
    const api = new ApiClient({
      baseUrl: '/api',
      getToken: vi.fn().mockResolvedValue('token'),
      onUnauthorized: vi.fn(),
      fetchImpl,
    });
    await api.get('/test');
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    );
  });
  it('refreshes once and retries one time on 401', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const getToken = vi
      .fn()
      .mockResolvedValueOnce('old')
      .mockResolvedValueOnce('new')
      .mockResolvedValueOnce('new');
    const api = new ApiClient({ baseUrl: '/api', getToken, onUnauthorized: vi.fn(), fetchImpl });
    await expect(api.get('/test')).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(getToken).toHaveBeenCalledWith(true);
  });
  it('does not loop after a second 401', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 401));
    const onUnauthorized = vi.fn();
    const api = new ApiClient({
      baseUrl: '/api',
      getToken: vi.fn().mockResolvedValue('token'),
      onUnauthorized,
      fetchImpl,
    });
    await expect(api.get('/test')).rejects.toBeInstanceOf(ApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
  it.each(['post', 'delete'] as const)('does not refresh or repeat a transactional %s when retryOnUnauthorized is false', async (method) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 401));
    const getToken = vi.fn().mockResolvedValue('test-token');
    const onUnauthorized = vi.fn();
    const api = new ApiClient({ baseUrl: '/api', getToken, onUnauthorized, fetchImpl });
    await expect(api[method]('/transaction', { id: 'LOT' }, {
      retryOnUnauthorized: false,
    })).rejects.toMatchObject({ kind: 'authentication', status: 401 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(getToken).toHaveBeenCalledExactlyOnceWith(false);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
  it('does not refresh or retry a 401 in dev-token mode', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 401));
    const getToken = vi.fn().mockResolvedValue('runtime-token');
    const onUnauthorized = vi.fn();
    const api = new ApiClient({
      baseUrl: '/api',
      getToken,
      onUnauthorized,
      refreshOnUnauthorized: false,
      fetchImpl,
    });
    let message = '';
    try {
      await api.get('/test');
    } catch (cause) {
      message = cause instanceof Error ? cause.message : String(cause);
    }
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(getToken).toHaveBeenCalledOnce();
    expect(getToken).toHaveBeenCalledWith(false);
    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(message).not.toContain('runtime-token');
  });
  it('shares one refresh across concurrent 401 responses', async () => {
    const attempts = new Map<string, number>();
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = input.toString();
      const attempt = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, attempt);
      return attempt === 1 ? jsonResponse({}, 401) : jsonResponse({ ok: true });
    });
    let resolveRefresh!: (token: string) => void;
    const refresh = new Promise<string>((resolve) => {
      resolveRefresh = resolve;
    });
    const getToken = vi.fn((force: boolean) => (force ? refresh : Promise.resolve('token')));
    const api = new ApiClient({ baseUrl: '/api', getToken, onUnauthorized: vi.fn(), fetchImpl });
    const calls = [api.get('/one'), api.get('/two')];
    await Promise.resolve();
    resolveRefresh('new');
    await Promise.all(calls);
    expect(getToken.mock.calls.filter(([force]) => force)).toHaveLength(1);
  });
  it('does not crash with an unbound global fetch when no fetchImpl override is given', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true }));
    try {
      const api = new ApiClient({
        baseUrl: '/api',
        getToken: vi.fn().mockResolvedValue('token'),
        onUnauthorized: vi.fn(),
      });
      await expect(api.get('/test')).resolves.toEqual({ ok: true });
    } finally {
      fetchSpy.mockRestore();
    }
  });
  it('classifies an already-typed token failure without touching fetch or turning it into a network error', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const getToken = vi
      .fn()
      .mockRejectedValue(
        new ApiError(
          'identity',
          'El token de desarrollo no contiene un identificador oid/sub utilizable.',
        ),
      );
    const api = new ApiClient({ baseUrl: '/api', getToken, onUnauthorized: vi.fn(), fetchImpl });
    await expect(api.get('/test')).rejects.toMatchObject({ kind: 'identity' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('wraps an unexpected token failure as configuration rather than network', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const getToken = vi.fn().mockRejectedValue(new Error('boom'));
    const api = new ApiClient({ baseUrl: '/api', getToken, onUnauthorized: vi.fn(), fetchImpl });
    await expect(api.get('/test')).rejects.toMatchObject({ kind: 'configuration' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

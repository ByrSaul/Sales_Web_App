import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSafeNavigate } from './useSafeNavigate';

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.restoreAllMocks(); });

describe('safe navigation', () => {
  it('preserves path, options and history delta without delaying navigation', () => {
    const { result } = renderHook(useSafeNavigate);
    result.current('/pedidos/OV-1', { replace: true, state: { from: 'review' } });
    expect(mocks.navigate).toHaveBeenLastCalledWith('/pedidos/OV-1', { replace: true, state: { from: 'review' } });
    result.current(-1);
    expect(mocks.navigate).toHaveBeenLastCalledWith(-1);
  });

  it.each(['sync', 'async'])('reports %s routing failures once without repeating a transition', async (mode) => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    mocks.navigate.mockImplementation(() => {
      if (mode === 'sync') throw new Error('router detail');
      return Promise.reject(new Error('router detail'));
    });
    const { result } = renderHook(useSafeNavigate);
    await act(async () => result.current('/home'));
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).not.toContain('router detail');
  });
});

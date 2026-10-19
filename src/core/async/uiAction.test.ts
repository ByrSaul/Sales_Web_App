import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/errors';
import { runUiAction } from './uiAction';

afterEach(() => vi.restoreAllMocks());

describe('UI action error boundary', () => {
  it('starts a synchronous action immediately and exactly once', () => {
    const action = vi.fn();
    const report = vi.fn();
    runUiAction(action, report);
    expect(action).toHaveBeenCalledTimes(1);
    expect(report).not.toHaveBeenCalled();
  });

  it('reports a synchronous failure without retrying', () => {
    const failure = new Error('failure');
    const action = vi.fn(() => { throw failure; });
    const report = vi.fn();
    expect(() => runUiAction(action, report)).not.toThrow();
    expect(report).toHaveBeenCalledExactlyOnceWith(failure);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('handles a rejected action once without leaving an unhandled rejection', async () => {
    const failure = new ApiError('timeout', 'internal detail');
    const action = vi.fn().mockRejectedValue(failure);
    const report = vi.fn();
    runUiAction(action, report);
    await Promise.resolve();
    expect(report).toHaveBeenCalledExactlyOnceWith(failure);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('leaves a successful asynchronous action untouched', async () => {
    const report = vi.fn();
    runUiAction(() => Promise.resolve({ ok: true }), report);
    await Promise.resolve();
    expect(report).not.toHaveBeenCalled();
  });

  it('presents a safe user message instead of the rejected payload', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    runUiAction(() => Promise.reject(new Error('private payload')));
    await Promise.resolve();
    expect(alert).toHaveBeenCalledExactlyOnceWith('Ocurrió un error inesperado. Intenta nuevamente.');
  });
});

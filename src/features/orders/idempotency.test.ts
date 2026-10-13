import { describe, expect, it } from 'vitest';
import { ApiError } from '../../core/api/errors';
import { canRetryWithNewKey, classifyCreationError, creationOutcomeMessage } from './idempotency';

// Textos reales de `IdempotencyService.begin_request` en fa-sales4app-proxy.
const PROCESSING = 'La petición ya se encuentra en procesamiento.';
const FAILED = 'La petición ya fue procesada previamente y falló; no se reintenta automáticamente.';
const MISMATCH = 'El Idempotency-Key ya fue utilizado con una petición diferente.';
const header409 = (detail: string) => new ApiError('backend', 'x', 409, { detail });
const line500 = (detail: string) => new ApiError('backend', 'x', 500, { detail });

describe('classifyCreationError', () => {
  it('reads Processing, Failed and mismatched body from the header 409 detail', () => {
    expect(classifyCreationError(header409(PROCESSING))).toEqual({ kind: 'processing' });
    expect(classifyCreationError(header409(FAILED))).toEqual({ kind: 'failed' });
    expect(classifyCreationError(header409(MISMATCH))).toEqual({ kind: 'mismatch' });
  });
  it('reads the same states when the line router wraps the 409 as a 500', () => {
    expect(classifyCreationError(line500(`409: ${PROCESSING}`))).toEqual({ kind: 'processing' });
    expect(classifyCreationError(line500(`409: ${FAILED}`))).toEqual({ kind: 'failed' });
    expect(classifyCreationError(line500(`409: ${MISMATCH}`))).toEqual({ kind: 'mismatch' });
  });
  it('treats timeouts, network errors, plain 5xx and unrecognized conflicts as unknown', () => {
    expect(classifyCreationError(new ApiError('timeout', 't'))).toEqual({ kind: 'unknown' });
    expect(classifyCreationError(new ApiError('network', 'n'))).toEqual({ kind: 'unknown' });
    expect(classifyCreationError(line500('Error de Dynamics'))).toEqual({ kind: 'unknown' });
    expect(classifyCreationError(new ApiError('backend', 'x', 502))).toEqual({ kind: 'unknown' });
    expect(classifyCreationError(header409('otro texto'))).toEqual({ kind: 'unknown' });
    expect(classifyCreationError(new ApiError('backend', 'x', 408))).toEqual({ kind: 'unknown' });
    expect(classifyCreationError(new ApiError('backend', 'x', 429))).toEqual({ kind: 'unknown' });
    expect(classifyCreationError(new Error('boom'))).toEqual({ kind: 'unknown' });
  });
  it('treats other 4xx as a confirmed rejection', () => {
    expect(classifyCreationError(new ApiError('backend', 'x', 422))).toEqual({ kind: 'rejected', status: 422 });
    expect(classifyCreationError(new ApiError('forbidden', 'x', 403))).toEqual({ kind: 'rejected', status: 403 });
  });
  it('only authorizes a new key after a confirmed Failed or rejection', () => {
    expect(canRetryWithNewKey({ kind: 'failed' })).toBe(true);
    expect(canRetryWithNewKey({ kind: 'rejected', status: 400 })).toBe(true);
    expect(canRetryWithNewKey({ kind: 'processing' })).toBe(false);
    expect(canRetryWithNewKey({ kind: 'mismatch' })).toBe(false);
    expect(canRetryWithNewKey({ kind: 'unknown' })).toBe(false);
  });
  it('never claims the server is still processing an unconfirmed operation as a fact', () => {
    expect(creationOutcomeMessage({ kind: 'unknown' })).toContain('todavía no ha confirmado');
    expect(creationOutcomeMessage({ kind: 'unknown' })).toContain('No vuelva a enviarla');
  });
});

describe('classifyCreationError · errores HTTP del Backend', () => {
  it('trata un 504 tipado de Dynamics como resultado desconocido', () => {
    const error = new ApiError('backend', 'x', 504, { code: 'DYNAMICS_TIMEOUT', message: 'timeout' });
    expect(classifyCreationError(error)).toEqual({ kind: 'unknown' });
  });
  it('trata 401 tras renovar el token como rechazo sin aplicar', () => {
    expect(classifyCreationError(new ApiError('authentication', 'x', 401))).toEqual({ kind: 'rejected', status: 401 });
  });
});

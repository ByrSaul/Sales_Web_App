import { ApiError } from '../../core/api/errors';

// A backend 5xx (or timeout/network/invalid-response) cannot be trusted to mean
// "nothing happened": the proxy collapses both pre-Dynamics failures and
// post-Dynamics connection drops into the same status codes. Any non-5xx ApiError
// (400/401/403/404/409/422) reflects a request Dynamics never had a chance to apply.
export const isAmbiguousError = (error: unknown): boolean =>
  error instanceof ApiError
    ? error.kind === 'timeout' ||
      error.kind === 'network' ||
      error.kind === 'invalid-response' ||
      (error.status ?? 0) >= 500
    : true;

export const mutationErrorMessage = (error: unknown): string =>
  error instanceof ApiError
    ? error.kind === 'timeout'
      ? 'La operación agotó el tiempo de espera; su resultado es ambiguo.'
      : error.kind === 'network'
        ? 'Se perdió la conexión; es necesario verificar Dynamics.'
        : error.status
          ? `Backend rechazó la operación (${error.status}).`
          : 'No fue posible comunicarse con el Backend.'
    : error instanceof Error
      ? error.message
      : 'Error inesperado.';

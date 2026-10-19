import { ApiError } from "../../core/api/errors";

// A backend 5xx (or timeout/network/invalid-response) cannot be trusted to mean
// "nothing happened": the proxy collapses both pre-Dynamics failures and
// post-Dynamics connection drops into the same status codes. Any non-5xx ApiError
// (400/401/403/404/409/422) reflects a request Dynamics never had a chance to apply.
/** Indica si un fallo de mutación requiere reconciliar el estado remoto. */
export const isAmbiguousError = (error: unknown): boolean =>
  error instanceof ApiError
    ? error.kind === "timeout" ||
      error.kind === "network" ||
      error.kind === "invalid-response" ||
      (error.status ?? 0) >= 500
    : true;

/** Obtiene un mensaje estable para registrar el resultado fallido de una mutación. */
export const mutationErrorMessage = (error: unknown): string => {
  if (!(error instanceof ApiError))
    return error instanceof Error ? error.message : "Error inesperado.";
  if (error.kind === "timeout")
    return "La operación agotó el tiempo de espera; su resultado es ambiguo.";
  if (error.kind === "network")
    return "Se perdió la conexión; es necesario verificar Dynamics.";
  if (error.status) return `Backend rechazó la operación (${error.status}).`;
  return "No fue posible comunicarse con el Backend.";
};

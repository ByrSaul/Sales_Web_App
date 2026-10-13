import { ApiError } from '../../core/api/errors';

/**
 * Contrato de idempotencia de `fa-sales4app-proxy` para las creaciones en Dynamics 365.
 *
 * - Rutas: `POST /d365/sales`, `POST /d365/sales/line` y `POST /d365/sales/line/agreement`.
 * - Header obligatorio `Idempotency-Key` con un UUID; si falta o no es UUID el Backend responde 422.
 * - La clave es única por compañía (`dataAreaId` + `Key`) y se asocia al hash del body.
 * - Misma clave + mismo body ya `Completed`: el Backend devuelve la respuesta original (replay).
 * - Misma clave en `Processing`, `Failed` o con otro body: 409. En las rutas de línea el
 *   router lo envuelve como 500 con `detail: "409: ..."`.
 * - Una clave `Failed` nunca vuelve a ejecutarse: un nuevo intento requiere una clave nueva.
 */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/**
 * Genera la clave de una operación lógica nueva.
 *
 * Se invoca una sola vez por operación (encabezado o línea) al crear su estado local, nunca
 * dentro del método HTTP: los reintentos reutilizan la clave persistida junto a la operación.
 */
export const newIdempotencyKey = (): string => crypto.randomUUID();

/** Construye el header que identifica la operación ante el Backend. */
export const idempotencyHeaders = (key: string): Record<string, string> => ({
  [IDEMPOTENCY_HEADER]: key,
});

const conflictDetail = (error: ApiError) => {
  const detail = (error.details as { detail?: unknown } | undefined)?.detail;
  return typeof detail === 'string' && /^409\b/.test(detail.trim());
};

/**
 * Indica que el Backend rechazó la clave porque ya existía (en proceso, fallida o con otro body).
 * No es un éxito ni un fallo definitivo de la operación original: su resultado sigue sin resolverse.
 */
export const isIdempotencyConflict = (error: unknown): boolean =>
  error instanceof ApiError &&
  error.kind === 'backend' &&
  (error.status === 409 || conflictDetail(error));

/**
 * Indica si la clave de una línea quedó inutilizable y puede renovarse para un nuevo intento.
 *
 * Solo aplica cuando el Backend respondió (terminó de procesar y registró `Failed`): 4xx o el 500
 * que generan los routers de línea. Se excluyen timeouts, errores de red, 408/429, 502-504 y los
 * conflictos de idempotencia, porque la operación original podría seguir en curso.
 * El llamador debe confirmar con `POST /d365/sales/line/query` que la línea no existe antes de
 * reenviarla con la clave nueva.
 */
export const canRenewIdempotencyKey = (error: unknown): boolean => {
  if (!(error instanceof ApiError) || error.kind !== 'backend' || error.status === undefined)
    return false;
  if (isIdempotencyConflict(error)) return false;
  const { status } = error;
  return (status >= 400 && status < 500 && status !== 408 && status !== 429) || status === 500;
};

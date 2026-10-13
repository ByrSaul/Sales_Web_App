import { ApiError } from '../../core/api/errors';

/**
 * Contrato de idempotencia de `fa-sales4app-proxy` para las creaciones en Dynamics 365
 * (verificado en `services/idempotency/idempotency_service.py` y en los routers de venta).
 *
 * - Rutas: `POST /d365/sales`, `POST /d365/sales/line` y `POST /d365/sales/line/agreement`.
 * - Header obligatorio `Idempotency-Key` con un UUID; si falta o no es UUID el Backend responde 422.
 * - La reserva se adquiere con un INSERT único por compañía (`dataAreaId` + `Key`) en la entidad
 *   `FAIdempotencyRequests`, con estados `Processing`, `Completed` y `Failed`, asociada al hash del body.
 * - Misma clave + mismo body `Completed`: el Backend devuelve la respuesta original (replay).
 * - Misma clave en `Processing`, en `Failed` o con otro body: 409 con un `detail` distinto para
 *   cada caso. En las rutas de línea el router lo envuelve como 500 con `detail: "409: ..."`.
 * - Una clave `Failed` nunca vuelve a ejecutarse: un nuevo intento requiere una clave nueva.
 * - Contrato acordado: el estado de una clave se consulta con el mismo POST, la misma clave y el
 *   mismo body. Una clave registrada nunca vuelve a ejecutar la operación (replay o 409), por lo
 *   que la consulta puede repetirse sin crear duplicados. Una consulta nunca genera claves nuevas.
 */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/**
 * Genera la clave de una operación lógica nueva.
 *
 * Se invoca una sola vez por operación (encabezado o línea) al crear su estado local, o cuando el
 * Backend ya confirmó que la operación anterior falló o fue rechazada. Nunca se llama dentro del
 * método HTTP ni para eludir un estado `Processing`, `Completed` o desconocido.
 */
export const newIdempotencyKey = (): string => crypto.randomUUID();

/** Construye el header que identifica la operación ante el Backend. */
export const idempotencyHeaders = (key: string): Record<string, string> => ({
  [IDEMPOTENCY_HEADER]: key,
});

/**
 * Resultado de una creación fallida, interpretado únicamente con lo que expone el Backend.
 *
 * - `processing`: el Backend confirmó `Processing`; no se reenvía.
 * - `failed`: el Backend confirmó `Failed`; solo admite un nuevo intento con otra clave.
 * - `mismatch`: la clave ya se usó con otro body; bloqueo hasta revisión manual.
 * - `rejected`: 4xx sin aplicar la operación (validación, autorización o rechazo de Dynamics).
 * - `unknown`: timeout, error de red, respuesta inválida o 5xx sin estado reconocible.
 */
export type CreationOutcome =
  | { kind: 'processing' }
  | { kind: 'failed' }
  | { kind: 'mismatch' }
  | { kind: 'rejected'; status: number }
  | { kind: 'unknown' };

const backendDetail = (error: ApiError): string => {
  const body = error.details as { detail?: unknown; message?: unknown } | undefined;
  const value = body?.detail ?? body?.message;
  return typeof value === 'string' ? value.trim() : '';
};

// Textos exactos que emite `IdempotencyService.begin_request` para cada estado del registro.
const PROCESSING_DETAIL = /en procesamiento/i;
const FAILED_DETAIL = /procesada previamente y fall/i;
const MISMATCH_DETAIL = /petici[oó]n diferente/i;

/** Clasifica el error de una creación idempotente sin suponer resultados que el Backend no confirmó. */
export const classifyCreationError = (error: unknown): CreationOutcome => {
  if (!(error instanceof ApiError) || error.status === undefined) return { kind: 'unknown' };
  const detail = backendDetail(error);
  const conflict =
    error.kind === 'backend' &&
    (error.status === 409 || (error.status === 500 && /^409\b/.test(detail)));
  if (conflict) {
    if (PROCESSING_DETAIL.test(detail)) return { kind: 'processing' };
    if (FAILED_DETAIL.test(detail)) return { kind: 'failed' };
    if (MISMATCH_DETAIL.test(detail)) return { kind: 'mismatch' };
    return { kind: 'unknown' };
  }
  const { status } = error;
  if (
    (error.kind === 'backend' || error.kind === 'forbidden' || error.kind === 'authentication') &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 429
  )
    return { kind: 'rejected', status };
  return { kind: 'unknown' };
};

/**
 * Indica si el Backend confirmó que la operación no quedó aplicada y puede intentarse de nuevo
 * con una clave nueva (`Failed` o rechazo 4xx). Timeouts, errores de red, 5xx, `Processing` y
 * claves usadas con otro body nunca habilitan un nuevo intento.
 */
export const canRetryWithNewKey = (outcome: CreationOutcome): boolean =>
  outcome.kind === 'failed' || outcome.kind === 'rejected';

/** Mensajes al usuario para cada resultado; no afirman nada que el Backend no haya confirmado. */
export const creationOutcomeMessage = (outcome: CreationOutcome): string => {
  switch (outcome.kind) {
    case 'processing':
      return 'El Backend confirma que la operación sigue en procesamiento (Processing). No la reenvíe; consulte su estado más tarde.';
    case 'failed':
      return 'El Backend confirmó que la operación falló (Failed). Puede reintentarse como una operación nueva.';
    case 'mismatch':
      return 'El Backend indica que la clave de idempotencia ya se usó con datos distintos. La operación queda bloqueada; verifique el pedido en Dynamics.';
    case 'rejected':
      return `El Backend rechazó la operación (${outcome.status}) sin aplicarla.`;
    default:
      return 'El servidor continúa procesando la operación o todavía no ha confirmado su resultado. No vuelva a enviarla hasta verificar su estado.';
  }
};

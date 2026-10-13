import type { CreationOutcome } from './idempotency';
import type { OperationTracking, OrderSubmission, OrderSubmissionGateway } from './types';

/**
 * Decisión sobre una nueva solicitud (otra clave) para una operación que terminó con error.
 *
 * - `safe`: el Backend confirma `Failed` + `dynamicsEffect: NONE` + `newRequestAllowed`, o que la
 *   clave nunca se registró (404 propio del endpoint).
 * - `created`: el Backend confirma efectos en Dynamics (`CREATED`); no debe crearse otra.
 * - `blocked`: cualquier otra respuesta, respuesta incompleta o consulta imposible.
 */
export type NewRequestDecision =
  | { decision: 'safe' }
  | { decision: 'created'; salesOrderNumber: string | null; lineReference: string | null }
  | { decision: 'blocked'; reason: string };

const MISSING_EVIDENCE =
  'El Backend no ha confirmado que el intento anterior no produjo efectos en Dynamics (se requiere Failed, dynamicsEffect NONE y newRequestAllowed). La nueva solicitud permanece bloqueada.';

/** Consulta, sin ejecutar nada, si es seguro crear una nueva solicitud con otra clave. */
export const assessNewRequest = async (
  gateway: Pick<OrderSubmissionGateway, 'getIdempotencyStatus'>,
  companyId: string,
  idempotencyKey: string,
): Promise<NewRequestDecision> => {
  if (!gateway.getIdempotencyStatus)
    return { decision: 'blocked', reason: `${MISSING_EVIDENCE} La consulta de idempotencia no está disponible.` };
  try {
    const view = await gateway.getIdempotencyStatus(companyId, idempotencyKey);
    if (view === null) return { decision: 'safe' };
    if (view.dynamicsEffect === 'CREATED')
      return {
        decision: 'created',
        salesOrderNumber: view.salesOrderNumber,
        lineReference: view.lineReference,
      };
    if (view.status === 'Failed' && view.dynamicsEffect === 'NONE' && view.newRequestAllowed)
      return { decision: 'safe' };
    return {
      decision: 'blocked',
      reason: `${MISSING_EVIDENCE} Estado informado: ${view.status} · efecto ${view.dynamicsEffect}.`,
    };
  } catch {
    return {
      decision: 'blocked',
      reason: `${MISSING_EVIDENCE} No fue posible consultar GET /d365/idempotency (el Backend desplegado podría no disponer del endpoint).`,
    };
  }
};

/** El resultado aún no está confirmado por el Backend: no se reenvía ni se renueva la clave. */
export const isUnresolvedTracking = (tracking: OperationTracking): boolean =>
  tracking === 'awaiting-confirmation' || tracking === 'processing' || tracking === 'mismatch';

/** El Backend confirmó que la operación no quedó aplicada: admite un nuevo intento con otra clave. */
export const isRetryableTracking = (tracking: OperationTracking): boolean =>
  tracking === 'failed' || tracking === 'rejected';

/** Traduce el resultado clasificado de una creación al seguimiento persistido. */
export const trackingFromOutcome = (outcome: CreationOutcome): OperationTracking => {
  switch (outcome.kind) {
    case 'processing':
      return 'processing';
    case 'failed':
      return 'failed';
    case 'mismatch':
      return 'mismatch';
    case 'rejected':
      return 'rejected';
    default:
      return 'awaiting-confirmation';
  }
};

/** Indica si la ejecución contiene una creación cuyo resultado el Backend no ha confirmado. */
export const hasUnresolvedOperation = (submission: OrderSubmission): boolean =>
  (!submission.salesOrderNumber && isUnresolvedTracking(submission.headerTracking)) ||
  submission.lines.some((line) => isUnresolvedTracking(line.tracking));

/** Indica si existe al menos una línea fallida o rechazada que el Backend permite reintentar. */
export const hasRetryableLine = (submission: OrderSubmission): boolean =>
  submission.lines.some((line) => isRetryableTracking(line.tracking));

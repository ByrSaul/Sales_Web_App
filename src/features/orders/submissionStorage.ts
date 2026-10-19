import { newIdempotencyKey } from './idempotency';
import { isUnresolvedTracking } from './operationTracking';
import type { OperationTracking, OrderSubmission, SubmissionLine } from './types';
export const ORDER_SUBMISSION_KEY = 'sales4app.orderSubmission.v1';
const key = (accountId: string, companyId: string) =>
  `${ORDER_SUBMISSION_KEY}.${encodeURIComponent(accountId)}.${encodeURIComponent(companyId)}`;
const IN_FLIGHT = new Set(['validating', 'creating-header', 'header-created', 'creating-lines', 'recovering']);

/** Seguimiento de una línea guardada antes de que existiera `tracking`. */
const legacyLineTracking = (line: SubmissionLine): OperationTracking => {
  if (line.status === 'created') return 'completed';
  // Una línea ya intentada sin resultado registrado se trata como desconocida: pudo crearse.
  return line.status === 'creating' || line.attempts > 0 ? 'awaiting-confirmation' : 'not-sent';
};

const restoreLine = (line: SubmissionLine): SubmissionLine => {
  const tracking = line.tracking ?? legacyLineTracking(line);
  const withKey = line.idempotencyKey ? line : { ...line, idempotencyKey: newIdempotencyKey() };
  // Un POST interrumpido por recarga o cierre nunca se reenvía automáticamente al recuperar.
  if (line.status === 'creating' || isUnresolvedTracking(tracking))
    return { ...withKey, tracking: isUnresolvedTracking(tracking) ? tracking : 'awaiting-confirmation', status: 'unconfirmed' };
  return { ...withKey, tracking };
};

/**
 * Normaliza una ejecución leída del almacenamiento sin cambiar `schemaVersion`.
 *
 * - Nunca reemplaza una clave existente. Las líneas antiguas sin clave reciben una, pero si ya se
 *   habían intentado quedan pendientes de confirmación y no se reenvían.
 * - Un encabezado ambiguo sin clave (registro anterior a la idempotencia) no puede verificarse.
 * - Un POST en curso al recargar (`creating-header`, `creating` en una línea) queda como
 *   `awaiting-confirmation`: pudo llegar a Dynamics y solo el Backend puede confirmarlo.
 */
const normalize = (s: OrderSubmission): OrderSubmission => {
  const lines = s.lines.map(restoreLine);
  let headerTracking: OperationTracking = 'not-sent';
  if (s.salesOrderNumber) headerTracking = 'completed';
  else if (s.headerAmbiguous || s.status === 'creating-header') headerTracking = 'awaiting-confirmation';
  headerTracking = s.headerTracking ?? headerTracking;
  const restored: OrderSubmission = {
    ...s,
    headerIdempotencyKey: s.headerIdempotencyKey ?? null,
    headerTracking:
      s.status === 'creating-header' && !s.salesOrderNumber ? 'awaiting-confirmation' : headerTracking,
    lines,
  };
  if (restored.status === 'creating-header' && !restored.salesOrderNumber)
    return {
      ...restored,
      status: 'failed',
      headerAmbiguous: true,
      error: 'El envío del encabezado se interrumpió antes de recibir respuesta; su resultado es ambiguo.',
    };
  if (restored.status === 'uploading-attachments')
    return {
      ...restored,
      status: 'partial-failure',
      attachmentRetryAllowed: false,
      attachmentError:
        'La carga de adjuntos se interrumpió. Verifique los adjuntos del pedido antes de continuar.',
      error:
        'La carga de adjuntos se interrumpió. Verifique los adjuntos del pedido antes de continuar.',
    };
  if (IN_FLIGHT.has(restored.status))
    return {
      ...restored,
      status: lines.some((line) => isUnresolvedTracking(line.tracking))
        ? 'awaiting-confirmation'
        : 'partial-failure',
    };
  return restored;
};
/** Persiste una ejecución de pedido para permitir su recuperación. */
export const saveSubmission = (s: OrderSubmission) =>
  localStorage.setItem(key(s.accountId, s.companyId), JSON.stringify(s));
export const clearSubmission = (accountId: string, companyId: string) =>
  localStorage.removeItem(key(accountId, companyId));
/** Inspecciona la ejecución persistida sin aplicar aún el filtro de compañía. */
export const peekSubmission = (accountId?: string): OrderSubmission | null => {
  let completed: OrderSubmission | null = null;
  for (let i = 0; i < localStorage.length; i += 1) {
    const storageKey = localStorage.key(i);
    if (!storageKey?.startsWith(`${ORDER_SUBMISSION_KEY}.`)) continue;
    try {
      const s = JSON.parse(localStorage.getItem(storageKey) ?? '') as OrderSubmission;
      if (s.schemaVersion !== 1 || (accountId && s.accountId !== accountId)) continue;
      if (s.status !== 'completed') return normalize(s);
      completed = normalize(s);
    } catch {
      continue;
    }
  }
  return completed;
};
/** Recupera una ejecución únicamente cuando coincide con cuenta y compañía activas. */
export const loadSubmission = (accountId: string, companyId: string) => {
  try {
    const raw = localStorage.getItem(key(accountId, companyId));
    if (!raw) return null;
    const s = JSON.parse(raw) as OrderSubmission;
    return s.schemaVersion === 1 && s.accountId === accountId && s.companyId === companyId
      ? normalize(s)
      : null;
  } catch {
    return null;
  }
};

import { newIdempotencyKey } from './idempotency';
import type { OrderSubmission } from './types';
export const ORDER_SUBMISSION_KEY = 'sales4app.orderSubmission.v1';
const key = (accountId: string, companyId: string) =>
  `${ORDER_SUBMISSION_KEY}.${encodeURIComponent(accountId)}.${encodeURIComponent(companyId)}`;
/**
 * Normaliza una ejecución leída del almacenamiento sin cambiar `schemaVersion`.
 *
 * - Registros anteriores a la idempotencia: las líneas sin clave reciben una nueva (su reenvío
 *   siempre pasa antes por la verificación de líneas existentes) y el encabezado queda en `null`,
 *   por lo que un encabezado ambiguo antiguo no puede reenviarse.
 * - Una ejecución interrumpida durante `creating-header` se trata como encabezado ambiguo y
 *   conserva su clave: el POST pudo llegar a Dynamics.
 * - Nunca reemplaza una clave existente.
 */
const normalize = (s: OrderSubmission): OrderSubmission => {
  const restored: OrderSubmission = {
    ...s,
    headerIdempotencyKey: s.headerIdempotencyKey ?? null,
    lines: s.lines.map((line) =>
      line.idempotencyKey ? line : { ...line, idempotencyKey: newIdempotencyKey() },
    ),
  };
  if (restored.status === 'creating-header' && !restored.salesOrderNumber)
    return {
      ...restored,
      status: 'failed',
      headerAmbiguous: true,
      error: 'El envío del encabezado se interrumpió antes de recibir respuesta; su resultado es ambiguo.',
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

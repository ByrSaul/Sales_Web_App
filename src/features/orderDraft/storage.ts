import type { OrderDraft } from './types';
export const ORDER_DRAFT_STORAGE_KEY = 'sales4app.orderDraft.v1';
export const ORDER_DRAFT_SCHEMA_VERSION = 1;
export const ORDER_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
type Envelope = {
  schemaVersion: number;
  updatedAt: string;
  accountId: string;
  companyId: string;
  draft: OrderDraft;
};
const available = () => typeof localStorage !== 'undefined';
/** Persiste el borrador con versión de esquema y fecha de expiración. */
export const saveDraft = (draft: OrderDraft) => {
  if (!available()) return;
  const value: Envelope = {
    schemaVersion: ORDER_DRAFT_SCHEMA_VERSION,
    updatedAt: draft.updatedAt,
    accountId: draft.accountId,
    companyId: draft.dataAreaId,
    draft,
  };
  localStorage.setItem(ORDER_DRAFT_STORAGE_KEY, JSON.stringify(value));
};
/** Elimina del almacenamiento local el borrador persistido. */
export const clearDraftStorage = () => {
  if (available()) localStorage.removeItem(ORDER_DRAFT_STORAGE_KEY);
};
/**
 * Recupera un borrador vigente y compatible con la identidad operativa indicada.
 *
 * @returns Borrador válido o `null` cuando falta, expiró o no corresponde al contexto.
 */
export const loadDraft = (
  accountId: string,
  companyId: string,
  current = Date.now(),
): OrderDraft | null => {
  if (!available()) return null;
  try {
    const raw = localStorage.getItem(ORDER_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const e = JSON.parse(raw) as Envelope;
    if (
      e.schemaVersion !== ORDER_DRAFT_SCHEMA_VERSION ||
      e.accountId !== accountId ||
      e.companyId !== companyId ||
      current - Date.parse(e.updatedAt) > ORDER_DRAFT_TTL_MS
    ) {
      clearDraftStorage();
      return null;
    }
    return e.draft;
  } catch {
    clearDraftStorage();
    return null;
  }
};

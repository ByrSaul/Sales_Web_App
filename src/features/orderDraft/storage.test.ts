import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrderDraft } from './domain';
import {
  clearDraftStorage,
  loadDraft,
  ORDER_DRAFT_STORAGE_KEY,
  ORDER_DRAFT_TTL_MS,
  saveDraft,
} from './storage';
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('crypto', { randomUUID: () => 'draft-id' });
});
const draft = () =>
  createOrderDraft(
    'account',
    { id: 'company', name: 'C', defaultCurrency: 'GTQ', availableCurrencies: ['GTQ'] },
    { id: 'vendor', name: 'V', companyId: 'company' },
    { id: 'user', name: 'U', language: 'es', personnelnumber: 'p' },
  );
describe('order draft persistence', () => {
  it('persists version and restores after reconstruction', () => {
    const d = draft();
    saveDraft(d);
    expect(JSON.parse(localStorage.getItem(ORDER_DRAFT_STORAGE_KEY)!).schemaVersion).toBe(1);
    expect(loadDraft('account', 'company')).toEqual(d);
  });
  it('discards another account', () => {
    saveDraft(draft());
    expect(loadDraft('other', 'company')).toBeNull();
    expect(localStorage.getItem(ORDER_DRAFT_STORAGE_KEY)).toBeNull();
  });
  it('discards another company', () => {
    saveDraft(draft());
    expect(loadDraft('account', 'other')).toBeNull();
  });
  it('discards expired drafts', () => {
    const d = draft();
    d.updatedAt = new Date(0).toISOString();
    saveDraft(d);
    expect(loadDraft('account', 'company', ORDER_DRAFT_TTL_MS + 1)).toBeNull();
  });
  it('clears for logout/company change', () => {
    saveDraft(draft());
    clearDraftStorage();
    expect(loadDraft('account', 'company')).toBeNull();
  });
  it('discards corrupt data', () => {
    localStorage.setItem(ORDER_DRAFT_STORAGE_KEY, '{');
    expect(loadDraft('account', 'company')).toBeNull();
  });
});

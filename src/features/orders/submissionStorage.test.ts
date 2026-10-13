import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSubmission,
  loadSubmission,
  peekSubmission,
  saveSubmission,
} from './submissionStorage';
import type { OrderSubmission } from './types';
const submission = (accountId: string, companyId: string): OrderSubmission => ({
  schemaVersion: 1,
  accountId,
  companyId,
  draftId: 'D',
  headerIdempotencyKey: 'header-key',
  headerTracking: 'completed',
  salesOrderNumber: 'OV',
  status: 'partial-failure',
  headerAmbiguous: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  snapshot: {} as OrderSubmission['snapshot'],
  lines: [],
  error: null,
});
beforeEach(() => localStorage.clear());
describe('submission recovery storage', () => {
  it('isolates recoveries by account and company', () => {
    saveSubmission(submission('A', 'CO1'));
    saveSubmission(submission('A', 'CO2'));
    saveSubmission(submission('B', 'CO1'));
    expect(loadSubmission('A', 'CO1')?.companyId).toBe('CO1');
    expect(loadSubmission('A', 'CO2')?.companyId).toBe('CO2');
    expect(loadSubmission('B', 'CO1')?.accountId).toBe('B');
  });
  it('does not expose another account recovery', () => {
    saveSubmission(submission('A', 'CO'));
    expect(loadSubmission('B', 'CO')).toBeNull();
    expect(peekSubmission('B')).toBeNull();
  });
  it('restores a legacy record without tracking conservatively', () => {
    const legacy = {
      ...submission('A', 'CO'),
      headerTracking: undefined,
      status: 'creating-lines',
      lines: [
        { localId: 'l1', idempotencyKey: 'k1', status: 'created', attempts: 1, error: null, backendLineNumber: 1, draftLine: {} },
        { localId: 'l2', idempotencyKey: 'k2', status: 'failed', attempts: 1, error: 'x', backendLineNumber: null, draftLine: {} },
        { localId: 'l3', idempotencyKey: '', status: 'pending', attempts: 0, error: null, backendLineNumber: null, draftLine: {} },
      ],
    } as unknown as OrderSubmission;
    saveSubmission(legacy);
    const restored = loadSubmission('A', 'CO')!;
    expect(restored.headerTracking).toBe('completed');
    expect(restored.status).toBe('awaiting-confirmation');
    expect(restored.lines.map((line) => [line.tracking, line.status])).toEqual([
      ['completed', 'created'],
      ['awaiting-confirmation', 'unconfirmed'],
      ['not-sent', 'pending'],
    ]);
    expect(restored.lines[1].idempotencyKey).toBe('k2');
    expect(restored.lines[2].idempotencyKey).toBeTruthy();
  });
  it('keeps an interrupted header POST as awaiting confirmation with its key', () => {
    saveSubmission({
      ...submission('A', 'CO'),
      salesOrderNumber: null,
      status: 'creating-header',
      headerTracking: 'awaiting-confirmation',
    });
    expect(loadSubmission('A', 'CO')).toMatchObject({
      status: 'failed',
      headerAmbiguous: true,
      headerTracking: 'awaiting-confirmation',
      headerIdempotencyKey: 'header-key',
    });
  });
  it('clears only the explicitly resolved recovery', () => {
    saveSubmission(submission('A', 'CO1'));
    saveSubmission(submission('A', 'CO2'));
    clearSubmission('A', 'CO1');
    expect(loadSubmission('A', 'CO1')).toBeNull();
    expect(loadSubmission('A', 'CO2')).not.toBeNull();
  });
});

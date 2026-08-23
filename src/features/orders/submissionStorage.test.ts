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
  it('clears only the explicitly resolved recovery', () => {
    saveSubmission(submission('A', 'CO1'));
    saveSubmission(submission('A', 'CO2'));
    clearSubmission('A', 'CO1');
    expect(loadSubmission('A', 'CO1')).toBeNull();
    expect(loadSubmission('A', 'CO2')).not.toBeNull();
  });
});

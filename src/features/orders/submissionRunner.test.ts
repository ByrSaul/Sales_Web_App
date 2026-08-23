import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../core/api/errors';
import { loadSubmission } from './submissionStorage';
import { SubmissionRunner } from './submissionRunner';
import { validDraft } from './testFixtures';
import type { ExistingSalesLine, OrderSubmissionGateway } from './types';
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('crypto', { randomUUID: () => `id-${Math.random()}` });
});
const backendLine = (item = 'I1', quantity = 1): ExistingSalesLine => ({
  lineNumber: 1,
  itemNumber: item,
  productConfigurationId: '',
  productStyleId: '',
  productSizeId: '',
  productColorId: '',
  productVersionId: '',
  salesPrice: 25,
  orderedSalesQuantity: quantity,
  shippingSiteId: 'S',
  shippingWarehouseId: 'W',
  csfaSuppItemGroupId: '',
  faBonification: 'No',
});
const gateway = () =>
  ({
    createHeader: vi
      .fn()
      .mockResolvedValue({
        dataAreaId: 'CO',
        salesOrderNumber: 'OV-1',
        salesOrderName: '',
        salesOrderStatus: '',
        customerAccount: 'C1',
        paymentTermsName: '',
      }),
    createNormalLine: vi.fn().mockResolvedValue([backendLine()]),
    createAgreementLine: vi.fn().mockResolvedValue([backendLine()]),
    getExistingLines: vi.fn().mockResolvedValue([]),
  }) as OrderSubmissionGateway;
describe('SubmissionRunner', () => {
  it('creates header then lines sequentially and completes', async () => {
    const g = gateway();
    const result = await new SubmissionRunner(g).submit(validDraft(2));
    expect(g.createHeader).toHaveBeenCalledTimes(1);
    expect(g.createNormalLine).toHaveBeenCalledTimes(2);
    expect(result.submission.status).toBe('completed');
    expect(result.submission.lines.every((x) => x.status === 'created')).toBe(true);
  });
  it('does not retry when a timed-out line already exists', async () => {
    const g = gateway();
    vi.mocked(g.createNormalLine).mockRejectedValue(new ApiError('timeout', 'timeout'));
    vi.mocked(g.getExistingLines).mockResolvedValue([backendLine()]);
    const result = await new SubmissionRunner(g).submit(validDraft());
    expect(g.createNormalLine).toHaveBeenCalledTimes(1);
    expect(result.completed).toBe(true);
  });
  it('retries once only after verification proves the line missing', async () => {
    const g = gateway();
    vi.mocked(g.createNormalLine)
      .mockRejectedValueOnce(new ApiError('network', 'lost'))
      .mockResolvedValueOnce([backendLine()]);
    const result = await new SubmissionRunner(g).submit(validDraft());
    expect(g.getExistingLines).toHaveBeenCalledTimes(1);
    expect(g.createNormalLine).toHaveBeenCalledTimes(2);
    expect(result.completed).toBe(true);
  });
  it('keeps partial recovery when verification is unavailable and continues', async () => {
    const g = gateway();
    vi.mocked(g.createNormalLine)
      .mockRejectedValueOnce(new ApiError('network', 'lost'))
      .mockResolvedValue([backendLine('I2', 2)]);
    vi.mocked(g.getExistingLines).mockRejectedValue(new ApiError('network', 'GET body blocked'));
    const result = await new SubmissionRunner(g).submit(validDraft(2));
    expect(result.submission.status).toBe('partial-failure');
    expect(result.submission.lines.map((x) => x.status)).toEqual(['failed', 'created']);
    expect(result.submission.salesOrderNumber).toBe('OV-1');
    expect(loadSubmission('A1', 'CO')?.status).toBe('partial-failure');
  });
  it('resumes persisted recovery without creating another header', async () => {
    const g1 = gateway();
    vi.mocked(g1.createNormalLine).mockRejectedValue(new ApiError('network', 'lost'));
    vi.mocked(g1.getExistingLines).mockRejectedValue(new Error('blocked'));
    const first = await new SubmissionRunner(g1).submit(validDraft());
    const g2 = gateway();
    const result = await new SubmissionRunner(g2).submit(
      first.submission.snapshot,
      first.submission,
    );
    expect(g2.createHeader).not.toHaveBeenCalled();
    expect(result.completed).toBe(true);
  });
  it('does not POST a recovered attempted line when preflight verification is unavailable', async () => {
    const g1 = gateway();
    vi.mocked(g1.createNormalLine).mockRejectedValue(new ApiError('network', 'lost'));
    vi.mocked(g1.getExistingLines).mockRejectedValue(new Error('blocked'));
    const first = await new SubmissionRunner(g1).submit(validDraft());
    const g2 = gateway();
    vi.mocked(g2.getExistingLines).mockRejectedValue(new Error('GET body blocked'));
    const result = await new SubmissionRunner(g2).submit(
      first.submission.snapshot,
      first.submission,
    );
    expect(g2.createNormalLine).not.toHaveBeenCalled();
    expect(result.submission.status).toBe('partial-failure');
  });
  it('never exceeds two total line attempts', async () => {
    const g = gateway();
    vi.mocked(g.createNormalLine).mockRejectedValue(new ApiError('backend', 'failed', 500));
    vi.mocked(g.getExistingLines).mockResolvedValue([]);
    const result = await new SubmissionRunner(g).submit(validDraft());
    expect(g.createNormalLine).toHaveBeenCalledTimes(2);
    expect(result.submission.lines[0].attempts).toBe(2);
    expect(result.submission.status).toBe('partial-failure');
  });
  it('protects against simultaneous double submit', async () => {
    const g = gateway();
    let resolve!: (value: {
      dataAreaId: string;
      salesOrderNumber: string;
      salesOrderName: string;
      salesOrderStatus: string;
      customerAccount: string;
      paymentTermsName: string;
    }) => void;
    vi.mocked(g.createHeader).mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const runner = new SubmissionRunner(g);
    const first = runner.submit(validDraft());
    await expect(runner.submit(validDraft())).rejects.toThrow('envío activo');
    resolve({
      dataAreaId: 'CO',
      salesOrderNumber: 'OV-1',
      salesOrderName: '',
      salesOrderStatus: '',
      customerAccount: 'C1',
      paymentTermsName: '',
    });
    await first;
    expect(g.createHeader).toHaveBeenCalledTimes(1);
  });
  it('does not process lines after a header failure', async () => {
    const g = gateway();
    vi.mocked(g.createHeader).mockRejectedValue(new ApiError('backend', 'bad', 422));
    const result = await new SubmissionRunner(g).submit(validDraft());
    expect(result.submission.status).toBe('failed');
    expect(result.submission.headerAmbiguous).toBe(false);
    expect(g.createNormalLine).not.toHaveBeenCalled();
  });
  it('persists an ambiguous header guard without inventing an order number', async () => {
    const g = gateway();
    vi.mocked(g.createHeader).mockRejectedValue(new ApiError('timeout', 'lost'));
    const result = await new SubmissionRunner(g).submit(validDraft());
    expect(result.submission.headerAmbiguous).toBe(true);
    expect(loadSubmission('A1', 'CO')).toMatchObject({
      status: 'failed',
      headerAmbiguous: true,
      salesOrderNumber: null,
    });
  });
});

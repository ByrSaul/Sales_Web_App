import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../core/api/apiClient';
import { agingSeverity, buildStatementSummary, mapInvoices, mapPdf } from './billingMappers';
import { billingService, openPdfReport } from './billingService';
import { billingKeys } from './billingQueries';
describe('billing contracts', () => {
  it('sends exact invoice filters and pagination', async () => {
    const post = vi.fn().mockResolvedValue({ invoices: [], pagination: {} });
    await billingService({ post } as unknown as ApiClient).invoices('CO', 'VEN', {
      customer: 'C1',
      from: '2026-01-01',
      to: '2026-02-01',
      openOnly: true,
      page: 3,
    });
    expect(post).toHaveBeenCalledWith(
      '/custumer/invoice',
      {
        company: 'CO',
        cust_id: 'C1',
        sales_group: 'VEN',
        has_pending_balance: true,
        pagination: { perpage: 10, page: 3 },
        from_date: '2026-01-01',
        to_date: '2026-02-01',
      },
      { signal: undefined },
    );
  });
  it('omits empty dates', async () => {
    const post = vi.fn().mockResolvedValue({ invoices: [], pagination: {} });
    await billingService({ post } as unknown as ApiClient).invoices('CO', 'V', {
      customer: '',
      from: '',
      to: '',
      openOnly: false,
      page: 1,
    });
    expect(post.mock.calls[0][1]).not.toHaveProperty('from_date');
    expect(post.mock.calls[0][1]).not.toHaveProperty('to_date');
  });
  it('maps invoice financial values without rounding', () => {
    const r = mapInvoices({
      invoices: [
        {
          invoiceid: 'F1',
          invoiceamount: 10.1234,
          remain: 3.4567,
          currencycode: 'EUR',
          status: 'Parcial',
        },
      ],
      pagination: { TotalRecords: 1, TotalPages: 1, CurrentPage: 1, PerPage: 10 },
    });
    expect(r.items[0]).toMatchObject({
      invoiceId: 'F1',
      invoiceAmount: 10.1234,
      balance: 3.4567,
      currency: 'EUR',
      status: 'Parcial',
    });
    expect(r.pagination.totalRecords).toBe(1);
  });
  it('segregates invoice cache across every filter', () =>
    expect(
      billingKeys.invoices('CO', 'V', {
        customer: 'C',
        from: 'A',
        to: 'B',
        openOnly: true,
        page: 2,
      }),
    ).toEqual(['invoices', 'CO', 'V', 'C', 'A', 'B', true, 2]));
  it('sends exact statement request', async () => {
    const post = vi.fn().mockResolvedValue([]);
    await billingService({ post } as unknown as ApiClient).statement('CO', 'C1', true);
    expect(post).toHaveBeenCalledWith(
      '/customer/statement',
      { company: 'CO', account_id: 'C1', multi_company: true },
      { signal: undefined },
    );
  });
  it('sends exact SSRS request with bounded report timeout', async () => {
    const post = vi.fn().mockResolvedValue({ FileName: 'F.pdf', FileBase64: 'JVBERg==' });
    await billingService({ post } as unknown as ApiClient).pdf('CO', 'F1');
    expect(post).toHaveBeenCalledWith(
      '/d365_services/get_ssrs_report_pdf',
      { Company: 'CO', DocumentId: 'F1', DocumentType: 1 },
      { timeoutMs: 120000 },
    );
  });
});
describe('statement and PDF', () => {
  const rows = [
    { voucher: 'A', time_period: 'Corriente', remainamountcur_usd: 100, remainamountcur: 777 },
    { voucher: 'B', time_period: '31-60 días', remainamountcur_usd: 30, días_diff: 40 },
    { voucher: 'C', time_period: '1-30 días', remainamountcur_usd: 20, días_diff: 10 },
  ];
  it('uses official USD balance and does not substitute local-currency values', () => {
    const s = buildStatementSummary(rows);
    expect(s.currentTotalUsd).toBe(100);
    expect(s.overdueTotalUsd).toBe(50);
  });
  it('builds dynamic buckets ordered by actual overdue days', () =>
    expect(buildStatementSummary(rows).aging.map((x) => x.label)).toEqual([
      '1-30 días',
      '31-60 días',
    ]));
  it('maps known severities without relying on color', () => {
    expect(agingSeverity('61-90 días')).toBe('En riesgo');
    expect(agingSeverity('Más de 90 días')).toBe('Crítico');
  });
  it('rejects empty PDF payloads', () =>
    expect(() => mapPdf({ FileName: 'x.pdf', FileBase64: '' })).toThrow(/no contiene/));
  it('rejects invalid or non-PDF Base64', () => {
    expect(() => openPdfReport('x.pdf', '%%%')).toThrow(/Base64/);
    expect(() => openPdfReport('x.pdf', 'aG9sYQ==')).toThrow(/PDF válido/);
  });
  it('creates PDF Blob and revokes its URL', () => {
    vi.useFakeTimers();
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    openPdfReport('../../Factura F1.pdf', 'JVBERg==');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ type: 'application/pdf' }));
    expect(open).toHaveBeenCalledWith('blob:pdf', '_blank', 'noopener');
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:pdf');
    vi.useRealTimers();
  });
});

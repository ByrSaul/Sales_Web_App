import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ invoices: vi.fn(), report: vi.fn() }));
vi.mock('../../features/billing/billingQueries', () => ({
  useInvoices: (f: unknown) => mocks.invoices(f),
  useReportService: () => mocks.report(),
}));
import InvoicesPage from './InvoicesPage';
afterEach(cleanup);
describe('InvoicesPage URL', () => {
  it('restores filters and changes page through URL-driven query', () => {
    mocks.report.mockReturnValue({ pdf: vi.fn() });
    mocks.invoices.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [
          {
            invoiceId: 'F1',
            customerAccount: 'C1',
            customerName: 'Cliente',
            salesId: 'OV',
            invoiceDate: '2026-01-01',
            dueDate: '2026-02-01',
            status: 'Vencida',
            invoiceAmount: 10,
            balance: 5,
            currency: 'USD',
            companyName: '',
          },
        ],
        pagination: { totalRecords: 20, totalPages: 3 },
      },
    });
    render(
      <MemoryRouter initialEntries={['/facturas?customer=C1&openOnly=true&page=2']}>
        <InvoicesPage />
      </MemoryRouter>,
    );
    expect(mocks.invoices).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'C1', openOnly: true, page: 2 }),
    );
    fireEvent.click(screen.getByText('Siguiente'));
    expect(mocks.invoices).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
  });
});

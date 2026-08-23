import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ orders: vi.fn() }));
vi.mock('../../app/providers/SessionProvider', () => ({ useSession: () => ({ context: { accountId: 'A', company: { id: 'CO' }, vendor: { id: 'V' } } }) }));
vi.mock('../../features/orders/orderQueries', () => ({ useOrders: (filters: unknown) => mocks.orders(filters) }));
import OrdersPage from './OrdersPage';
const Location = () => <span data-testid="location">{useLocation().pathname}{useLocation().search}</span>;
describe('OrdersPage URL flow', () => {
  it('loads URL filters and preserves them when opening detail', () => { mocks.orders.mockReturnValue({ isLoading: false, isError: false, data: { items: [{ companyId: 'CO', salesOrderNumber: 'OV-1', currencyCode: 'GTQ', createdDate: '', deliveryDate: '', status: 'Orden Abierta', customerAccount: 'C1', customerName: 'Cliente', salesGroup: 'V', paymentTerms: '', creditManagement: '', creditStatus: '', salesAmount: 10, address: '', confirmDocumentNumber: '', observations: '', customerReference: '', matchingAgreement: null, agreementId: '' }], pagination: { currentPage: 4, totalPages: 5, totalRecords: 50 } } }); render(<MemoryRouter initialEntries={['/pedidos?page=4&customer=C1']}><Routes><Route path="/pedidos" element={<OrdersPage/>}/><Route path="*" element={<Location/>}/></Routes></MemoryRouter>); expect(mocks.orders).toHaveBeenCalledWith(expect.objectContaining({ page: 4, customer: 'C1' })); fireEvent.click(screen.getByText('OV-1')); expect(screen.getByTestId('location')).toHaveTextContent('/pedidos/OV-1?page=4&customer=C1'); });
});

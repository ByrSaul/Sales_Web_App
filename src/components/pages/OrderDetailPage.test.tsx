import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ detail: vi.fn(), mutations: vi.fn() }));
vi.mock('../../app/providers/SessionProvider', () => ({
  useSession: () => ({ context: { permissions: [], company: { id: 'CO' } } }),
}));
vi.mock('../../features/orders/orderQueries', () => ({
  useOrderDetail: (id: string) => mocks.detail(id),
  useOrderMutations: (id: string) => mocks.mutations(id),
}));
import OrderDetailPage from './OrderDetailPage';
afterEach(() => cleanup());
describe('OrderDetailPage direct route', () => {
  it('loads by URL and safely blocks line mutation without InventoryLotId', () => {
    const order = {
      companyId: 'CO',
      salesOrderNumber: 'OV-9',
      currencyCode: 'GTQ',
      createdDate: '',
      deliveryDate: '',
      status: 'Orden Abierta',
      customerAccount: 'C',
      customerName: 'Cliente',
      salesGroup: 'V',
      paymentTerms: '',
      creditManagement: '',
      creditStatus: '',
      salesAmount: 10,
      address: '',
      confirmDocumentNumber: '',
      observations: '',
      customerReference: '',
      matchingAgreement: null,
      agreementId: '',
    };
    const line = {
      lineNumber: 1,
      itemId: 'I',
      displayProductNumber: 'I',
      quantity: 1,
      lineAmount: 10,
      price: 10,
      itemName: 'Item',
      inventoryLotId: '',
      status: '',
      isBonification: false,
      matchingAgreementLine: null,
    };
    mocks.detail.mockReturnValue({
      header: { isLoading: false, isError: false, data: order, refetch: vi.fn() },
      lines: { isLoading: false, isError: false, data: [line], refetch: vi.fn() },
    });
    mocks.mutations.mockReturnValue({
      update: { mutateAsync: vi.fn(), isPending: false },
      cancel: { mutateAsync: vi.fn(), isPending: false },
      confirm: { mutateAsync: vi.fn(), isPending: false },
    });
    render(
      <MemoryRouter initialEntries={['/pedidos/OV-9']}>
        <Routes>
          <Route path="/pedidos/:salesOrderNumber" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(mocks.detail).toHaveBeenCalledWith('OV-9');
    expect(screen.getByText('BLOQUEANTE BACKEND')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  });
  it('logically blocks double cancellation and confirmation submits', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const order = {
      companyId: 'CO',
      salesOrderNumber: 'OV-9',
      currencyCode: 'GTQ',
      createdDate: '',
      deliveryDate: '',
      status: 'Orden Abierta',
      customerAccount: 'C',
      customerName: 'Cliente',
      salesGroup: 'V',
      paymentTerms: '',
      creditManagement: '',
      creditStatus: '',
      salesAmount: 10,
      address: '',
      confirmDocumentNumber: '',
      observations: '',
      customerReference: '',
      matchingAgreement: null,
      agreementId: '',
    };
    const line = {
      lineNumber: 1,
      itemId: 'I',
      displayProductNumber: 'I',
      quantity: 1,
      lineAmount: 10,
      price: 10,
      itemName: 'Item',
      inventoryLotId: 'LOT',
      status: 'Orden Abierta',
      isBonification: false,
      matchingAgreementLine: null,
    };
    const pending = new Promise(() => undefined);
    const cancel = vi.fn(() => pending);
    const confirm = vi.fn(() => pending);
    mocks.detail.mockReturnValue({
      header: { isLoading: false, isError: false, data: order, refetch: vi.fn() },
      lines: { isLoading: false, isError: false, data: [line], refetch: vi.fn() },
    });
    mocks.mutations.mockReturnValue({
      update: { mutateAsync: vi.fn(), isPending: false },
      cancel: { mutateAsync: cancel, isPending: false },
      confirm: { mutateAsync: confirm, isPending: false },
    });
    render(
      <MemoryRouter initialEntries={['/pedidos/OV-9']}>
        <Routes>
          <Route path="/pedidos/:salesOrderNumber" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const cancelButton = screen.getByRole('button', { name: 'Cancelar' });
    fireEvent.click(cancelButton);
    fireEvent.click(cancelButton);
    const confirmButton = screen.getByRole('button', { name: 'Confirmar pedido' });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledTimes(1);
  });
});

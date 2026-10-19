import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyOperationalContext } from '../../core/session/storage';
import { mapOrder } from '../../features/orders/orderMappers';
import type { OrderFilters } from '../../features/orders/orderTypes';
import OrdersPage from './OrdersPage';
const mocks = vi.hoisted(() => ({ orders: vi.fn(), recovery: vi.fn(), retry: vi.fn() }));
vi.mock('../../features/orders/orderQueries', () => ({
  useOrders: (...args: unknown[]) => mocks.orders(...args),
}));
vi.mock('../../features/orders/submissionStorage', () => ({
  peekSubmission: (...args: unknown[]) => mocks.recovery(...args),
}));
vi.mock('../../app/providers/SessionProvider', () => ({
  useSession: () => ({ context: { ...emptyOperationalContext('A1'), company: { id: 'CO' } } }),
}));
const order = {
  ...mapOrder({}),
  salesOrderNumber: 'OV/1',
  customerAccount: 'C1',
  customerName: 'Cliente',
  currencyCode: 'GTQ',
  salesAmount: 50,
  status: 'Orden Abierta',
};
const query = (items = [order], page = 1) => ({
  data: { items, pagination: { currentPage: page, totalPages: 2 } },
  isLoading: false,
  isError: false,
  refetch: mocks.retry,
});
const Location = () => {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
};
const mount = (path = '/pedidos') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <OrdersPage />
      <Location />
    </MemoryRouter>,
  );
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.retry.mockResolvedValue(undefined);
  mocks.recovery.mockReturnValue(null);
  mocks.orders.mockImplementation((filters: OrderFilters, enabled: boolean) => ({
    ...query([order], filters.page),
    data: enabled ? query([order], filters.page).data : undefined,
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe('OrdersPage filters, history and recovery', () => {
  it('waits for explicit search, applies every filter and clears them without another enabled query', () => {
    mount();
    expect(screen.getByText('Define los filtros y pulsa Buscar')).toBeInTheDocument();
    expect(mocks.orders.mock.lastCall![1]).toBe(false);
    for (const [label, value] of [
      ['Desde', '2026-10-01'],
      ['Hasta', '2026-10-19'],
      ['Estado', 'Entregado'],
      ['Cuenta cliente', 'C1'],
      ['Control de crédito', 'Si'],
    ])
      change(label, value);
    expect(mocks.orders.mock.lastCall![1]).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(mocks.orders).toHaveBeenLastCalledWith(
      {
        customer: 'C1',
        status: 'Entregado',
        creditControl: 'Si',
        from: '2026-10-01',
        to: '2026-10-19',
        page: 1,
        perPage: 10,
      },
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(mocks.orders.mock.lastCall![1]).toBe(false);
    expect(screen.getByLabelText('Cuenta cliente')).toHaveValue('');
    expect(screen.getByLabelText('Desde')).not.toHaveValue('');
  });
  it('omits blank optional fields, retains search filters during pagination and disables bounds', () => {
    mount('/pedidos?searched=1&customer=C1&from=2026-10-01&to=2026-10-19');
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(mocks.orders.mock.lastCall![0]).toMatchObject({ customer: 'C1', page: 2 });
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(mocks.orders.mock.lastCall![0].page).toBe(1);
    change('Cuenta cliente', '');
    change('Desde', '');
    change('Hasta', '');
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/pedidos?page=1&searched=1');
  });
  it.each(['loading', 'error', 'empty'])('shows %s query feedback', (state) => {
    mocks.orders.mockReturnValue({
      ...query([]),
      isLoading: state === 'loading',
      isError: state === 'error',
    });
    mount('/pedidos?searched=1');
    const messages: Record<string, string> = {
      loading: 'Cargando pedidos...',
      error: 'No se pudo consultar el historial.',
      empty: 'No se encontraron pedidos',
    };
    expect(screen.getByText(messages[state])).toBeInTheDocument();
  });
  it('reports a rejected read-only refresh exactly once', async () => {
    mocks.orders.mockReturnValue({ ...query([]), isError: true });
    mocks.retry.mockRejectedValue(new Error('offline'));
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    mount('/pedidos?searched=1');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Intentar nuevamente' }));
    });
    expect(mocks.retry).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(1);
  });
  it('opens an encoded order detail with applied filters and displays official amounts', () => {
    mount('/pedidos?searched=1&customer=C1');
    expect(screen.getByText('GTQ 50.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /OV\/1.*Cliente/ }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/pedidos/OV%2F1?searched=1&customer=C1',
    );
  });
  it('navigates to creation without submitting an order', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Crear pedido' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/crear-pedido');
  });
  it.each(['completed', 'other-company', 'header', 'order'])(
    'handles %s local recovery without claiming it is official state',
    (state) => {
      mocks.recovery.mockReturnValue({
        companyId: state === 'other-company' ? 'OT' : 'CO',
        status: state === 'completed' ? 'completed' : 'partial-failure',
        salesOrderNumber: state === 'header' ? null : 'OV/2',
      });
      mount();
      if (state === 'completed' || state === 'other-company') {
        expect(screen.queryByText('Recuperación local pendiente')).not.toBeInTheDocument();
        return;
      }
      expect(screen.getByText('Recuperación local pendiente')).toBeInTheDocument();
      expect(screen.getByText(/No representa el estado oficial/)).toBeInTheDocument();
      if (state === 'header')
        expect(screen.queryByRole('button', { name: 'Consultar pedido' })).not.toBeInTheDocument();
      else {
        fireEvent.click(screen.getByRole('button', { name: 'Consultar pedido' }));
        expect(screen.getByTestId('location')).toHaveTextContent('/pedidos/OV%2F2');
      }
      expect(mocks.recovery).toHaveBeenCalledWith('A1');
    },
  );
});

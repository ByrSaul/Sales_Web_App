import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { NewAddressForm } from '../orders/NewAddressForm';
import type { VatSelector } from '../orders/VatSelector';
import { emptyOperationalContext } from '../../core/session/storage';
import { validDraft } from '../../features/orders/testFixtures';
import ClientsPage from './ClientsPage';
const mocks = vi.hoisted(() => ({ customers: vi.fn(), addresses: vi.fn(), retry: vi.fn() }));
vi.mock('../../features/catalogs/hooks', () => ({
  useCustomers: (...args: unknown[]) => mocks.customers(...args),
  useCustomerAddresses: (...args: unknown[]) => mocks.addresses(...args),
}));
vi.mock('../../app/providers/SessionProvider', () => ({
  useSession: () => ({ context: { ...emptyOperationalContext('A1'), company: { id: 'CO' } } }),
}));
vi.mock('../orders/NewAddressForm', () => ({
  NewAddressForm: (props: ComponentProps<typeof NewAddressForm>) => (
    <section>
      <p>Formulario {props.customerAccount}</p>
      <button onClick={props.onCancel}>Cancelar dirección</button>
      <button
        onClick={() =>
          props.onCreated({
            recId: 9,
            locationId: 'NEW',
            description: 'Nueva',
            formattedAddress: 'Zona 9',
            countryId: 'GTM',
            roles: 'Delivery',
          })
        }
      >
        Guardar dirección
      </button>
    </section>
  ),
}));
vi.mock('../orders/VatSelector', () => ({
  VatSelector: (props: ComponentProps<typeof VatSelector>) => (
    <section>
      <p>País fiscal {props.countryId}</p>
      <p>NIF seleccionado {props.value}</p>
      <button onClick={() => props.onChange('NIT-1')}>Seleccionar NIF</button>
    </section>
  ),
}));
const first = { ...validDraft().customer!, name: 'Cliente Alfa', creditAvailableUsd: 32.5 };
const second = {
  ...first,
  account: 'MOST-000001',
  name: 'Cliente Contado',
  paymentTerms: '',
  blocked: 1,
};
const address = {
  recId: 1,
  locationId: 'L1',
  description: 'Oficina',
  formattedAddress: 'Zona 1',
  countryId: 'GTM',
  roles: 'Delivery',
};
const query = (data: unknown) => ({ data, isPending: false, isError: false, refetch: mocks.retry });
let client: QueryClient;
const Location = () => <output data-testid="location">{useLocation().search}</output>;
const mount = (search = 'cliente', onStatement = vi.fn()) => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return {
    onStatement,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/?search=' + search]}>
          <ClientsPage onEstadoCuenta={onStatement} />
          <Location />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
};
const select = (name = 'Cliente Alfa') =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.retry.mockResolvedValue(undefined);
  mocks.customers.mockImplementation((_search: string, page: number) =>
    query({
      items: [first, second],
      pagination: { currentPage: page, totalPages: 2, totalRecords: 2 },
    }),
  );
  mocks.addresses.mockReturnValue(query([address]));
});
afterEach(() => {
  cleanup();
  client?.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ClientsPage search and customer details', () => {
  it('requires a nonblank search before showing cached customers', () => {
    mount('');
    expect(
      screen.getByText('Escriba una cuenta o nombre para buscar clientes'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cliente Alfa/ })).not.toBeInTheDocument();
  });
  it.each(['loading', 'error', 'empty', 'absent'])('shows %s customer results', (state) => {
    mocks.customers.mockReturnValue({
      ...query(state === 'absent' ? undefined : { items: [], pagination: {} }),
      isPending: state === 'loading',
      isError: state === 'error',
    });
    mount();
    const messages: Record<string, string> = {
      loading: 'Buscando clientes...',
      error: 'No fue posible cargar los clientes.',
    };
    expect(screen.getByText(messages[state] ?? 'No se encontraron clientes')).toBeInTheDocument();
  });
  it('catches a rejected customer retry without another automatic request', async () => {
    mocks.customers.mockReturnValue({ ...query(undefined), isError: true });
    mocks.retry.mockRejectedValue(new Error('offline'));
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    mount();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Intentar nuevamente' }));
    });
    expect(mocks.retry).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(1);
  });
  it('shows active/blocked customers, selects and dims cards, invokes the statement and closes details', () => {
    const { onStatement } = mount();
    expect(screen.getByText('BLOQUEADO')).toBeInTheDocument();
    expect(screen.getByText('ACTIVO')).toBeInTheDocument();
    select();
    expect(mocks.addresses).toHaveBeenLastCalledWith('C1');
    expect(screen.getByRole('button', { name: /Cliente Alfa/ })).toHaveClass('opacity-100');
    expect(screen.getByRole('button', { name: /Cliente Contado/ })).toHaveClass('opacity-50');
    fireEvent.click(screen.getByRole('button', { name: 'Estado de cuenta' }));
    expect(onStatement).toHaveBeenCalledExactlyOnceWith('C1');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle del cliente' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
  it('paginates using the applied search, closes selection and disables bounds', () => {
    mount();
    select();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(mocks.customers).toHaveBeenLastCalledWith('cliente', 2);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(mocks.customers).toHaveBeenLastCalledWith('cliente', 1);
  });
  it('debounces typed searches and resets pagination', () => {
    vi.useFakeTimers();
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.change(screen.getByPlaceholderText('Cuenta o nombre...'), {
      target: { value: 'nuevo' },
    });
    expect(mocks.customers).toHaveBeenLastCalledWith('cliente', 2);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mocks.customers).toHaveBeenLastCalledWith('nuevo', 1);
    expect(screen.getByTestId('location')).toHaveTextContent('search=nuevo&page=1');
  });
  it.each(['loading', 'error', 'empty', 'success'])(
    'shows %s addresses inside the selected customer',
    (state) => {
      mocks.addresses.mockReturnValue({
        ...query(state === 'success' ? [address] : []),
        isPending: state === 'loading',
        isError: state === 'error',
      });
      mount();
      select();
      const messages: Record<string, string> = {
        loading: 'Cargando direcciones...',
        error: 'No fue posible cargar las direcciones.',
        empty: 'Sin direcciones',
        success: 'Oficina',
      };
      expect(screen.getByText(messages[state])).toBeInTheDocument();
    },
  );
  it('handles a rejected address refresh from customer details', async () => {
    mocks.addresses.mockReturnValue({ ...query(undefined), isError: true });
    mocks.retry.mockRejectedValue(new Error('offline'));
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    mount();
    select();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Intentar nuevamente' }));
    });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(mocks.retry).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])(
    'closes the address form after creation and handles invalidation rejection (%s)',
    async (fails) => {
      mount();
      const invalidation = vi.spyOn(client, 'invalidateQueries');
      if (fails) invalidation.mockRejectedValue(new Error('cache failed'));
      const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
      select();
      fireEvent.click(screen.getByRole('button', { name: 'Nueva dirección' }));
      expect(screen.getByText('Formulario C1')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar dirección' }));
      expect(screen.queryByText('Formulario C1')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Nueva dirección' }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Guardar dirección' }));
      });
      expect(screen.queryByText('Formulario C1')).not.toBeInTheDocument();
      expect(invalidation).toHaveBeenCalledTimes(1);
      expect(alert).toHaveBeenCalledTimes(Number(fails));
    },
  );
  it('shows NIF only for the cash account, filters unusable addresses and clears old fiscal selections', () => {
    mocks.addresses.mockReturnValue(
      query([
        address,
        {
          ...address,
          recId: 2,
          locationId: 'L2',
          description: '',
          formattedAddress: 'Sucursal',
          countryId: 'SLV',
        },
        { ...address, recId: 3, locationId: '', countryId: '' },
      ]),
    );
    mount();
    select('Cliente Contado');
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getByLabelText('Dirección para NIF').querySelectorAll('option')).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('Dirección para NIF'), { target: { value: 'L1' } });
    expect(screen.getByText('País fiscal GTM')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar NIF' }));
    expect(screen.getByText('NIF seleccionado NIT-1')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Dirección para NIF'), { target: { value: 'L2' } });
    expect(screen.getByText('País fiscal SLV')).toBeInTheDocument();
    expect(screen.queryByText('NIF seleccionado NIT-1')).not.toBeInTheDocument();
    select();
    expect(screen.queryByLabelText('Dirección para NIF')).not.toBeInTheDocument();
  });
});

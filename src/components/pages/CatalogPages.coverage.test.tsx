import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as map from '../../features/catalogs/mappers';
import ProductsPage from './ProductsPage';
import InventoryPage from './InventoryPage';
import CustomerAddressesPage from './CustomerAddressesPage';

const mocks = vi.hoisted(() => ({
  products: vi.fn(),
  infinite: vi.fn(),
  variants: vi.fn(),
  inventory: vi.fn(),
  addresses: vi.fn(),
  retry: vi.fn(),
  more: vi.fn(),
}));
vi.mock('../../features/catalogs/hooks', () => ({
  useProducts: (...args: unknown[]) => mocks.products(...args),
  useInfiniteProducts: (...args: unknown[]) => mocks.infinite(...args),
  useVariants: (...args: unknown[]) => mocks.variants(...args),
  useInventory: (...args: unknown[]) => mocks.inventory(...args),
  useCustomerAddresses: (...args: unknown[]) => mocks.addresses(...args),
}));
const product = {
  itemId: 'I1',
  name: 'Producto simple',
  productType: 'Product',
  dimensionGroup: '',
  requiresVariant: false,
};
const master = { ...product, itemId: 'M1', name: 'Producto maestro', requiresVariant: true };
const variant = {
  itemId: 'M1',
  displayProductNumber: 'M1-V',
  name: 'Azul',
  dimensionGroup: '',
  configId: 'CFG',
  sizeId: '',
  colorId: 'BLUE',
  styleId: '',
  versionId: '',
};
const stock = {
  ...map.inventory({}),
  companyId: 'CO',
  itemId: 'I1',
  productName: 'Existencia',
  siteId: 'S1',
  warehouseId: 'W1',
  totalAvailable: 12,
  physical: 15,
};
const address = {
  recId: 1,
  locationId: 'L1',
  description: 'Oficina',
  formattedAddress: 'Zona 1',
  countryId: 'GTM',
  roles: 'Delivery',
};
const pagination = { ...map.pagination({}), totalPages: 2, totalRecords: 2 };
const query = (data: unknown) => ({
  data,
  isPending: false,
  isError: false,
  isLoading: false,
  isFetching: false,
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
const content = (element: React.ReactNode) => (
  <>
    <Routes>
      <Route path="/clientes/:customerAccount/direcciones" element={element} />
      <Route path="*" element={element} />
    </Routes>
    <Location />
  </>
);
const mount = (element: React.ReactNode, path = '/') =>
  render(<MemoryRouter initialEntries={[path]}>{content(element)}</MemoryRouter>);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.retry.mockResolvedValue(undefined);
  mocks.more.mockResolvedValue(undefined);
  mocks.products.mockImplementation((_search: string, page: number) =>
    query({ items: [product, master], pagination: { ...pagination, currentPage: page } }),
  );
  mocks.infinite.mockReturnValue({
    items: [product, master],
    isFetching: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: mocks.more,
  });
  mocks.variants.mockReturnValue(query({ items: [variant] }));
  mocks.inventory.mockReturnValue(query({ items: [stock], pagination }));
  mocks.addresses.mockReturnValue(query([address]));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ProductsPage functional coverage', () => {
  it.each(['loading', 'error', 'empty', 'absent'])(
    'presents %s products without selectable stale results',
    (state) => {
      const result = query({ items: [], pagination });
      mocks.products.mockReturnValue({
        ...result,
        data: state === 'absent' ? undefined : result.data,
        isPending: state === 'loading',
        isError: state === 'error',
      });
      mount(<ProductsPage />);
      const messages: Record<string, string> = {
        loading: 'Cargando productos...',
        error: 'No fue posible cargar productos.',
      };
      expect(
        screen.getByText(messages[state] ?? 'No se encontraron productos'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Producto simple/ })).not.toBeInTheDocument();
    },
  );
  it('reports a rejected retry without leaving an unhandled promise or repeating the request', async () => {
    mocks.products.mockReturnValue({ ...query(undefined), isError: true });
    mocks.retry.mockRejectedValue(new Error('private'));
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    mount(<ProductsPage />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Intentar nuevamente' }));
    });
    expect(mocks.retry).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(1);
  });
  it('selects a master, shows loading variants and then its real dimensions', () => {
    mocks.variants.mockReturnValue({ ...query(undefined), isPending: true });
    const view = mount(<ProductsPage />);
    fireEvent.click(screen.getByRole('button', { name: /M1.*Producto maestro/ }));
    expect(mocks.variants).toHaveBeenLastCalledWith(master);
    expect(screen.getByText('Cargando variantes...')).toBeInTheDocument();
    mocks.variants.mockReturnValue(query({ items: [variant] }));
    view.rerender(<MemoryRouter>{content(<ProductsPage />)}</MemoryRouter>);
    expect(screen.getByText('M1-V')).toBeInTheDocument();
    expect(screen.getByText(/CFG \/ BLUE/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /I1.*Producto simple/ }));
    expect(screen.queryByText('M1-V')).not.toBeInTheDocument();
  });
  it('paginates using the same search and disables both bounds', () => {
    mount(<ProductsPage />, '/productos?search=arroz');
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(mocks.products).toHaveBeenLastCalledWith('arroz', 2);
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(mocks.products).toHaveBeenLastCalledWith('arroz', 1);
  });
  it('debounces search, resets the page and removes an empty search from the URL', () => {
    vi.useFakeTimers();
    mount(<ProductsPage />);
    fireEvent.change(screen.getByPlaceholderText('Código o nombre...'), {
      target: { value: 'semilla' },
    });
    expect(mocks.products).toHaveBeenLastCalledWith('', 1);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mocks.products).toHaveBeenLastCalledWith('semilla', 1);
    expect(screen.getByTestId('location')).toHaveTextContent('search=semilla');
    fireEvent.change(screen.getByPlaceholderText('Código o nombre...'), { target: { value: '' } });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('location')).not.toHaveTextContent('search=');
  });
});

describe('InventoryPage selection and availability', () => {
  const select = (value = 'I1') =>
    fireEvent.change(screen.getByLabelText('Producto'), { target: { value } });
  it('does not show inventory until a product and its required variant are selected', () => {
    mount(<InventoryPage />);
    expect(screen.getByText('Selecciona un producto')).toBeInTheDocument();
    select('M1');
    expect(screen.getByText('Selecciona una variante')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Variante obligatoria'), { target: { value: 'M1-V' } });
    expect(mocks.inventory).toHaveBeenLastCalledWith(master, 'M1-V', 1);
    expect(screen.getByRole('table')).toBeInTheDocument();
    select();
    expect(screen.queryByLabelText('Variante obligatoria')).not.toBeInTheDocument();
    expect(mocks.inventory).toHaveBeenLastCalledWith(product, '', 1);
    select('');
    expect(screen.getByText('Selecciona un producto')).toBeInTheDocument();
  });
  it.each(['loading', 'error', 'empty'])(
    'shows the %s inventory state after selection',
    (state) => {
      mocks.inventory.mockReturnValue({
        ...query({ items: [], pagination }),
        isPending: state === 'loading',
        isError: state === 'error',
      });
      mount(<InventoryPage />);
      select();
      const messages: Record<string, string> = {
        loading: 'Consultando inventario...',
        error: 'No fue posible consultar el inventario.',
        empty: 'Sin inventario disponible',
      };
      expect(screen.getByText(messages[state])).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    },
  );
  it('shows physical quantities, empty locations and availability without changing stock', () => {
    mocks.inventory.mockReturnValue(
      query({
        items: [
          stock,
          {
            ...stock,
            itemId: 'I2',
            displayProductNumber: 'I2-V',
            siteId: '',
            warehouseId: '',
            totalAvailable: 0,
          },
        ],
        pagination,
      }),
    );
    mount(<InventoryPage />);
    select();
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(within(rows[1]).getByText('12')).toBeInTheDocument();
    expect(within(rows[1]).getByText('DISPONIBLE')).toBeInTheDocument();
    expect(within(rows[2]).getAllByText('N/A')).toHaveLength(2);
    expect(within(rows[2]).getByText('SIN EXISTENCIA')).toBeInTheDocument();
    expect(stock.totalAvailable).toBe(12);
  });
  it('changes inventory pages and resets the page on another product selection', () => {
    mount(<InventoryPage />);
    select();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(mocks.inventory).toHaveBeenLastCalledWith(product, '', 2);
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(mocks.inventory).toHaveBeenLastCalledWith(product, '', 1);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    select('M1');
    expect(mocks.inventory).toHaveBeenLastCalledWith(master, '', 1);
  });
  it('debounces product search and handles a rejected next-page fetch once', async () => {
    vi.useFakeTimers();
    mocks.infinite.mockReturnValue({ ...mocks.infinite(), hasNextPage: true, isFetching: true });
    mocks.more.mockRejectedValue(new Error('offline'));
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    mount(<InventoryPage />);
    expect(screen.getByRole('option', { name: 'Buscando...' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar producto'), { target: { value: 'maiz' } });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mocks.infinite).toHaveBeenLastCalledWith('maiz', true);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cargar más productos' }));
    });
    expect(mocks.more).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(1);
  });
  it('handles a rejected inventory retry and unavailable variant records', async () => {
    mocks.inventory.mockReturnValue({ ...query(undefined), isError: true });
    mocks.variants.mockReturnValue({ ...query(undefined), isFetching: true });
    mocks.retry.mockRejectedValue(new Error('offline'));
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    mount(<InventoryPage />);
    select('M1');
    expect(screen.getByRole('option', { name: 'Cargando...' })).toBeInTheDocument();
    select();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Intentar nuevamente' }));
    });
    expect(mocks.retry).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(1);
  });
});

describe('CustomerAddressesPage', () => {
  it.each(['loading', 'error', 'empty', 'absent'])('shows %s addresses', (state) => {
    mocks.addresses.mockReturnValue({
      ...query(state === 'absent' ? undefined : []),
      isLoading: state === 'loading',
      isError: state === 'error',
    });
    mount(<CustomerAddressesPage />);
    const messages: Record<string, string> = {
      loading: 'Consultando direcciones...',
      error: 'No se pudieron consultar las direcciones existentes.',
    };
    expect(
      screen.getByText(messages[state] ?? 'El cliente no tiene direcciones'),
    ).toBeInTheDocument();
  });
  it.each(['', '?search=C1&page=2'])(
    'preserves navigation filters %s and renders stable records',
    (suffix) => {
      mocks.addresses.mockReturnValue(
        query([address, { ...address, recId: 0, locationId: 'L2', description: 'Bodega' }]),
      );
      mount(<CustomerAddressesPage />, '/clientes/C1/direcciones' + suffix);
      expect(screen.getAllByText('Zona 1', { selector: 'p' })).toHaveLength(2);
      expect(mocks.addresses).toHaveBeenLastCalledWith('C1');
      fireEvent.click(screen.getByRole('button', { name: 'Nueva dirección' }));
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/clientes/C1/direcciones/nueva' + suffix,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Volver a clientes' }));
      expect(screen.getByTestId('location')).toHaveTextContent('/clientes' + suffix);
    },
  );
  it('handles a rejected read-only address retry', async () => {
    mocks.addresses.mockReturnValue({ ...query(undefined), isError: true });
    mocks.retry.mockRejectedValue(new Error('offline'));
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    mount(<CustomerAddressesPage />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Intentar nuevamente' }));
    });
    expect(mocks.retry).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(1);
  });
});

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyOperationalContext } from '../../core/session/storage';
import { validDraft } from '../../features/orders/testFixtures';
import * as map from '../../features/catalogs/mappers';
import AddOrderLinePage from './AddOrderLinePage';
const mocks = vi.hoisted(() => ({
  products: vi.fn(),
  variants: vi.fn(),
  inventory: vi.fn(),
  refs: vi.fn(),
  post: vi.fn(),
  draft: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  retry: vi.fn(),
  more: vi.fn(),
  session: vi.fn(),
}));
const transport = { post: mocks.post };
vi.mock('../../app/providers/SessionProvider', () => ({
  useSession: () => ({ api: transport, context: mocks.session() }),
}));
vi.mock('../../features/catalogs/hooks', () => ({
  useInfiniteProducts: (...args: unknown[]) => mocks.products(...args),
  useVariants: (...args: unknown[]) => mocks.variants(...args),
  useInventory: (...args: unknown[]) => mocks.inventory(...args),
  useReferenceCatalogs: () => mocks.refs(),
}));
vi.mock('../../features/orderDraft/OrderDraftProvider', () => ({
  useOrderDraft: () => ({
    draft: mocks.draft(),
    update: mocks.update,
    addLines: mocks.add,
    removeLine: mocks.remove,
  }),
}));
const product = {
  itemId: 'I1',
  name: 'Producto',
  productType: 'Item',
  dimensionGroup: '',
  requiresVariant: false,
};
const variant = {
  itemId: 'I1',
  displayProductNumber: 'VAR1',
  name: 'Variante',
  dimensionGroup: '',
  configId: 'CFG',
  colorId: '',
  sizeId: '',
  styleId: '',
  versionId: '',
};
const stock = {
  ...map.inventory({}),
  companyId: 'CO',
  itemId: 'I1',
  siteId: 'S1',
  warehouseId: 'W1',
  availablePhysical: 50,
  totalAvailable: 50,
};
const promotion = { companyId: 'CO', groupId: 'P1', name: 'Promo', recId: 1, forecastDiscount: 10 };
const query = (data: unknown) => ({
  data,
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: mocks.retry,
});
let draft: ReturnType<typeof validDraft>;
let client: QueryClient;
const Location = () => <output data-testid="location">{useLocation().pathname}</output>;
const content = () => (
  <MemoryRouter>
    <AddOrderLinePage />
    <Location />
  </MemoryRouter>
);
const mount = () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={client}>{content()}</QueryClientProvider>);
};
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const choose = async () => {
  change('Buscar producto', 'I1');
  fireEvent.click(await screen.findByRole('button', { name: /I1.*Producto/ }, { timeout: 2500 }));
};
const prepare = async () => {
  await choose();
  await waitFor(() => expect(screen.getByLabelText('Precio (GTQ)')).toHaveValue(25));
  fireEvent.click(screen.getByRole('button', { name: /S1.*W1/ }));
};
beforeEach(() => {
  vi.resetAllMocks();
  draft = validDraft();
  mocks.draft.mockImplementation(() => draft);
  mocks.session.mockReturnValue(emptyOperationalContext('A1'));
  mocks.products.mockReturnValue({
    items: [product],
    isFetching: false,
    isError: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    refetch: mocks.retry,
    fetchNextPage: mocks.more,
  });
  mocks.variants.mockReturnValue(query({ items: [variant] }));
  mocks.inventory.mockReturnValue(query({ items: [stock] }));
  mocks.refs.mockReturnValue({ promotions: { data: [promotion] } });
  mocks.post.mockImplementation(async (path: string) => {
    if (path === '/d365_services/get_price')
      return { Success: true, Price: 25, PriceUnit: 1, Currencycode: 'GTQ' };
    return [];
  });
  mocks.retry.mockResolvedValue(undefined);
  mocks.more.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  client?.clear();
  vi.restoreAllMocks();
});
describe('AddOrderLinePage commercial selection', () => {
  it('retains the agreement reference and prevents quantities beyond its remaining balance', async () => {
    draft = { ...draft, agreement: map.agreement({ recid: 42, agreementid: 'AG-1' }) };
    mocks.post.mockImplementation(async (path: string) => {
      if (path === '/customer/agreement/parcial_lines')
        return [
          { matchingagreementline: 7, itemid: 'I1', qtyline: 3 },
          { matchingagreementline: 8, itemid: 'OTHER', qtyline: 100 },
        ];
      return { Success: true, Price: 25, PriceUnit: 1, Currencycode: 'GTQ' };
    });
    mount();
    await prepare();
    expect(
      screen.getByLabelText('Línea de acuerdo (opcional)').querySelectorAll('option'),
    ).toHaveLength(2);
    change('Línea de acuerdo (opcional)', '7');
    change('Cantidad', '4');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'La cantidad excede el saldo restante del acuerdo.',
    );
    expect(screen.getByRole('button', { name: 'Agregar línea' })).toBeDisabled();
    change('Cantidad', '3');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar línea' }));
    expect(mocks.add.mock.calls[0][0]).toMatchObject({
      matchingAgreementLine: 7,
      agreementRemainingQuantity: 3,
      quantity: 3,
    });
    expect(mocks.post).toHaveBeenCalledWith(
      '/customer/agreement/parcial_lines',
      { company: 'CO', account_id: 'C1', recid: 42 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
  it('blocks adding a line while the price request is still pending', async () => {
    let release!: (value: unknown) => void;
    mocks.post.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    mount();
    await choose();
    fireEvent.click(screen.getByRole('button', { name: /S1.*W1/ }));
    expect(screen.getByText('Calculando precio...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar línea' })).toBeDisabled();
    await act(async () => {
      release({ Success: true, Price: 25, Currencycode: 'GTQ' });
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Agregar línea' })).toBeEnabled(),
    );
    expect(mocks.add).not.toHaveBeenCalled();
  });
  it('requires a selection, adds a valid local line and resets inputs without creating a sales order', async () => {
    mount();
    expect(screen.getByRole('button', { name: 'Agregar línea' })).toBeDisabled();
    await prepare();
    change('Cantidad', '2');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar línea' }));
    expect(mocks.add).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        product,
        quantity: 2,
        siteId: 'S1',
        warehouseId: 'W1',
        price: expect.objectContaining({ price: 25 }),
        independentBonification: false,
      }),
    );
    expect(screen.getByLabelText('Buscar producto')).toHaveValue('');
    expect(screen.getByLabelText('Cantidad')).toHaveValue(1);
    expect(mocks.post.mock.calls.some(([path]) => path === '/d365/sales/line')).toBe(false);
  });
  it('validates a nonpositive quantity before adding', async () => {
    mount();
    await prepare();
    change('Cantidad', '0');
    expect(screen.getByRole('alert')).toHaveTextContent('La cantidad debe ser mayor que cero.');
    expect(screen.getByRole('button', { name: 'Agregar línea' })).toBeDisabled();
    expect(mocks.add).not.toHaveBeenCalled();
  });
  it('keeps manual price locked without the nested permission', async () => {
    mount();
    await prepare();
    expect(screen.getByLabelText('Precio (GTQ)')).toBeDisabled();
    expect(screen.getByText(/Sin permiso Create Sales Orders/)).toBeInTheDocument();
  });
  it('accepts an authorized override, validates zero and clears it on a different product search', async () => {
    mocks.session.mockReturnValue({
      ...emptyOperationalContext('A1'),
      permissions: [
        {
          menu: 'Create Sales Orders',
          company: 'CO',
          permissionLevel: 'Editar',
          children: [
            { menu: 'Price Sales Line', company: 'CO', permissionLevel: 'Editar', children: [] },
          ],
        },
      ],
    });
    mount();
    await prepare();
    change('Precio (GTQ)', '0');
    expect(screen.getByRole('button', { name: 'Agregar línea' })).toBeDisabled();
    change('Precio (GTQ)', '30');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar línea' }));
    expect(mocks.add.mock.calls[0][0].price.price).toBe(30);
    await prepare();
    expect(screen.getByLabelText('Precio (GTQ)')).toHaveValue(25);
  });
  it('passes a linked promotion and keeps independent bonuses at zero without a promotion', async () => {
    mount();
    await prepare();
    change('Cantidad', '20');
    change('Promoción vinculada (opcional)', 'P1');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar línea' }));
    expect(mocks.add.mock.calls[0][0].promotion).toEqual(promotion);
    await prepare();
    fireEvent.click(screen.getByRole('switch', { name: 'Bonificación independiente' }));
    expect(screen.getByText('Precio: 0 (bonificación independiente)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Promoción vinculada (opcional)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar línea' }));
    expect(mocks.add.mock.calls[1][0]).toMatchObject({
      independentBonification: true,
      price: null,
      promotion: null,
    });
  });
  it('selects a required variant and forces registry using the delivery country', async () => {
    mocks.products.mockReturnValue({
      ...mocks.products(),
      items: [{ ...product, requiresVariant: true, productType: 'MasterProduct' }],
    });
    const view = mount();
    await choose();
    expect(screen.getByRole('button', { name: 'Agregar línea' })).toBeDisabled();
    change('Variante obligatoria', 'VAR1');
    expect(mocks.inventory).toHaveBeenLastCalledWith(
      expect.objectContaining({ itemId: 'I1' }),
      'VAR1',
      1,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Forzar registro' }));
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ forceRegisterVariant: true });
    draft = { ...draft, forceRegisterVariant: true };
    view.rerender(<QueryClientProvider client={client}>{content()}</QueryClientProvider>);
    expect(mocks.variants.mock.lastCall![1]).toEqual({
      forceRegistry: true,
      regionId: draft.deliveryAddress!.countryId,
    });
    expect(screen.getByLabelText('Variante obligatoria')).toHaveValue('');
  });
  it('blocks forced registry without a delivery country and tolerates absent variant lists', async () => {
    draft = { ...draft, forceRegisterVariant: true, deliveryAddress: null };
    mocks.products.mockReturnValue({
      ...mocks.products(),
      items: [{ ...product, requiresVariant: true }],
    });
    mocks.variants.mockReturnValue({ ...query(undefined), isLoading: true, isFetching: true });
    mount();
    await choose();
    expect(screen.getByRole('switch', { name: 'Forzar registro' })).toBeDisabled();
    expect(screen.getByLabelText('Variante obligatoria')).toBeDisabled();
    expect(screen.getByText(/no contiene CountryRegionId/)).toBeInTheDocument();
  });
  it('renders draft lines and removes only the selected local ID', () => {
    draft.lines[0] = { ...draft.lines[0], isBonification: true, price: 0 };
    mount();
    expect(screen.getByText('Bonificación')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(draft.lines[0].localId);
    fireEvent.click(screen.getByRole('button', { name: 'Encabezado' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/crear-pedido');
    fireEvent.click(screen.getByRole('button', { name: /Revisar/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/crear-pedido/revision');
  });
  it.each(['loading', 'error', 'empty'])(
    'shows the product search %s state and catches query retries',
    async (state) => {
      mocks.products.mockReturnValue({
        ...mocks.products(),
        items: [],
        isFetching: state === 'loading',
        isError: state === 'error',
      });
      mocks.retry.mockRejectedValue(new Error('offline'));
      const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
      mount();
      change('Buscar producto', 'I1');
      const messages: Record<string, string> = {
        loading: 'Buscando productos...',
        error: 'No fue posible consultar productos.',
        empty: 'No se encontraron productos.',
      };
      await screen.findByText(messages[state], {}, { timeout: 2500 });
      if (state === 'error') {
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
        });
        expect(alert).toHaveBeenCalledTimes(1);
      }
      expect(mocks.add).not.toHaveBeenCalled();
    },
  );
  it('fetches more products once and catches a rejected pagination request', async () => {
    mocks.products.mockReturnValue({
      ...mocks.products(),
      hasNextPage: true,
      isFetchingNextPage: false,
    });
    mocks.more.mockRejectedValue(new Error('offline'));
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    mount();
    change('Buscar producto', 'I1');
    const button = await screen.findByRole(
      'button',
      { name: 'Cargar más productos' },
      { timeout: 2500 },
    );
    await act(async () => {
      fireEvent.click(button);
    });
    expect(mocks.more).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(1);
  });
  it('shows inventory loading, error and empty feedback and catches a rejected refresh', async () => {
    mocks.inventory.mockReturnValue({ ...query({ items: [] }), isLoading: true, isError: true });
    mocks.retry.mockRejectedValue(new Error('offline'));
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    mount();
    expect(screen.getByText('Consultando inventario...')).toBeInTheDocument();
    expect(screen.getByText('Sin inventario para la selección.')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Intentar nuevamente' }));
    });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(mocks.add).not.toHaveBeenCalled();
  });
  it('displays a backend price rejection without inventing a usable price', async () => {
    mocks.post.mockRejectedValue(new Error('offline'));
    mount();
    await choose();
    await screen.findByText('Error al consultar precio.');
    expect(screen.getByRole('button', { name: 'Agregar línea' })).toBeDisabled();
    expect(screen.getByLabelText('Precio')).toHaveValue(null);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    });
    expect(mocks.post).toHaveBeenCalledTimes(2);
  });
  it('shows the backend debug explanation for a zero price', async () => {
    mocks.post.mockResolvedValue({
      Success: true,
      Price: 0,
      Currencycode: 'GTQ',
      DebugMessage: 'Sin lista de precios',
    });
    mount();
    await choose();
    await screen.findByText('Sin lista de precios');
    expect(screen.getByLabelText('Precio (GTQ)')).toHaveValue(0);
    expect(mocks.add).not.toHaveBeenCalled();
  });
});

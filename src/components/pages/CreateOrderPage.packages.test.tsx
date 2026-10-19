import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { CustomerAddressSelector } from '../orders/CustomerAddressSelector';
import { OrderDraftProvider, useOrderDraft } from '../../features/orderDraft/OrderDraftProvider';
import { saveDraft } from '../../features/orderDraft/storage';
import { validDraft } from '../../features/orders/testFixtures';
import { catalogService } from '../../features/catalogs/catalogService';
import { agreementLine } from '../../features/catalogs/mappers';
import { agreementLineSelection } from '../../features/orderDraft/agreementPackage';
import type { ApiClient } from '../../core/api/apiClient';
import type { OrderDraft } from '../../features/orderDraft/types';
import {
  mapHeaderRequest,
  mapAgreementLineRequest,
} from '../../features/orders/orderSubmissionMapper';
import { SubmissionRunner } from '../../features/orders/submissionRunner';
import CreateOrderPage from './CreateOrderPage';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  list: vi.fn(),
  details: vi.fn(),
  customers: vi.fn(),
  session: vi.fn(),
}));
const transport = { post: mocks.post };
vi.mock('../../app/providers/SessionProvider', () => ({ useSession: () => mocks.session() }));
function useReferences(account: string) {
  const agreements = useQuery({
    queryKey: ['test-agreements', account],
    queryFn: ({ signal }) =>
      catalogService(transport as unknown as ApiClient).agreements('CO', account, { signal }),
    enabled: Boolean(account),
    retry: false,
  });
  return { agreements, delivery: { data: [] }, origins: { data: [] } };
}
vi.mock('../../features/catalogs/hooks', () => ({
  useInfiniteCustomers: () => mocks.customers(),
  useReferenceCatalogs: (account: string) => useReferences(account),
}));
vi.mock('../orders/CustomerAddressSelector', () => ({
  CustomerAddressSelector: (props: ComponentProps<typeof CustomerAddressSelector>) => (
    <button onClick={() => props.onSelect(validDraft().deliveryAddress)}>
      Seleccionar dirección
    </button>
  ),
}));

const packages = [
  {
    recid: 305,
    salesnumbersequence: 'PQT-000305',
    documenttitle: 'PQT Hortalizas 20%',
    customerdataareaid: 'CO',
    custaccount: 'C1',
    currency: 'GTQ',
  },
  {
    recid: 306,
    salesnumbersequence: 'PQT-000306',
    documenttitle: 'Otro paquete',
    customerdataareaid: 'CO',
    custaccount: 'C1',
    currency: 'GTQ',
  },
];
const rows = [
  {
    linenumber: 1,
    matchingagreementline: 7001,
    customerdataareaid: 'CO',
    custaccount: 'C1',
    salesnumbersequence: 'PQT-000305',
    currency: 'GTQ',
    inventsiteid: 'S-PACK',
    inventlocationid: 'W-PACK',
    itemid: 'I1',
    name: 'Hortalizas',
    displayproductnumber: 'VAR-PACK',
    configid: 'CFG',
    inventcolorid: 'VERDE',
    inventsizeid: 'GRANDE',
    inventstyleid: 'ESTILO',
    inventversionid: 'V2',
    commitedquantityqty: 20,
    totalqty: 7.5,
    qtyline: 12.5,
    price: 31.7,
    debugmessage: '',
  },
  {
    linenumber: 2,
    matchingagreementline: 7002,
    customerdataareaid: 'CO',
    custaccount: 'C1',
    salesnumbersequence: 'PQT-000305',
    currency: 'GTQ',
    inventsiteid: 'S2',
    inventlocationid: 'W2',
    itemid: 'I2',
    name: 'Semilla',
    displayproductnumber: '',
    configid: '',
    inventcolorid: '',
    inventsizeid: '',
    inventstyleid: '',
    inventversionid: '',
    commitedquantityqty: 8,
    totalqty: 2,
    qtyline: 6,
    price: 8.25,
    debugmessage: '',
  },
];
const secondRows = rows
  .slice(0, 1)
  .map((row) => ({
    ...row,
    matchingagreementline: 8001,
    salesnumbersequence: 'PQT-000306',
    price: 19,
  }));
const initial = () => ({ ...validDraft(), lines: [] });
const Snapshot = () => {
  const { draft, addLines } = useOrderDraft();
  const location = useLocation();
  return (
    <>
      <pre data-testid="draft">{JSON.stringify(draft)}</pre>
      <output data-testid="location">{location.pathname}</output>
      <button onClick={() => addLines(agreementLineSelection(agreementLine(rows[0]), 1))}>
        Añadir referencia de prueba
      </button>
    </>
  );
};
const snapshot = (): OrderDraft =>
  JSON.parse(screen.getByTestId('draft').textContent ?? '{}') as OrderDraft;
let client: QueryClient;
const mount = (draft: OrderDraft = initial()) => {
  saveDraft(draft);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/crear-pedido']}>
        <OrderDraftProvider>
          <Routes>
            <Route path="/crear-pedido" element={<CreateOrderPage />} />
            <Route path="*" element={<p>Página siguiente</p>} />
          </Routes>
          <Snapshot />
        </OrderDraftProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};
const select = (id = '305') =>
  fireEvent.change(screen.getByLabelText('Acuerdo comercial (opcional)'), {
    target: { value: id },
  });
const continueButton = () => screen.getByRole('button', { name: 'Continuar a líneas' });
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  const draft = validDraft();
  mocks.session.mockReturnValue({
    api: transport,
    context: {
      accountId: 'A1',
      company: {
        id: 'CO',
        name: 'Empresa',
        defaultCurrency: 'GTQ',
        availableCurrencies: ['GTQ', 'USD'],
      },
      vendor: { id: 'V1', name: 'Vendedor', companyId: 'CO' },
      user: { id: 'U1', name: 'Usuario', language: 'es', personnelnumber: 'P1', networkAlias: '' },
      permissions: [],
    },
  });
  mocks.customers.mockReturnValue({
    items: [draft.customer, { ...draft.customer, account: 'C2', name: 'Otro cliente' }],
    isFetching: false,
    isError: false,
    hasNextPage: false,
  });
  mocks.list.mockResolvedValue({ agreement: packages });
  mocks.details.mockImplementation(async (recid: number) => ({
    parcial_lines: recid === 305 ? rows : secondRows,
  }));
  mocks.post.mockImplementation(
    async (path: string, body: { recid?: number; account_id?: string }) => {
      if (path === '/customer/agreement') return mocks.list(body.account_id);
      if (path === '/customer/agreement/parcial_lines') return mocks.details(body.recid);
      throw new Error('Unexpected endpoint ' + path);
    },
  );
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  client?.clear();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Commercial packages from the real backend contract', () => {
  it('aligns supported package currencies and blocks a later conflicting manual currency', async () => {
    mocks.list.mockResolvedValue({ agreement: [{ ...packages[0], currency: 'USD' }] });
    mocks.details.mockResolvedValue({
      parcial_lines: rows.map((row) => ({ ...row, currency: 'USD' })),
    });
    mount();
    await screen.findByRole('option', { name: /PQT-000305/ });
    select();
    await screen.findByText(/2 líneas del paquete disponibles/);
    expect(snapshot().currencyCode).toBe('USD');
    fireEvent.change(screen.getByLabelText('Moneda'), { target: { value: 'GTQ' } });
    expect(
      screen.getByText('Seleccione la moneda del paquete para continuar.'),
    ).toBeInTheDocument();
    expect(continueButton()).toBeDisabled();
    expect(snapshot().lines).toEqual([]);
  });
  it('keeps customers without packages on the unchanged manual-line route', async () => {
    mocks.list.mockResolvedValue({ agreement: [] });
    mount();
    await waitFor(() => expect(continueButton()).toBeEnabled());
    expect(
      screen.getByLabelText('Acuerdo comercial (opcional)').querySelectorAll('option'),
    ).toHaveLength(1);
    fireEvent.click(continueButton());
    expect(screen.getByTestId('location')).toHaveTextContent('/crear-pedido/linea');
    expect(mocks.details).not.toHaveBeenCalled();
  });
  it.each([1, 2])('shows %s available packages without selecting one implicitly', async (count) => {
    mocks.list.mockResolvedValue({ agreement: packages.slice(0, count) });
    mount();
    await screen.findByRole('option', { name: /PQT-000305/ });
    expect(
      screen.getByLabelText('Acuerdo comercial (opcional)').querySelectorAll('option'),
    ).toHaveLength(count + 1);
    expect(snapshot().agreement).toBeNull();
    expect(mocks.details).not.toHaveBeenCalled();
  });
  it('builds every package line exactly once using backend quantities, prices, references and dimensions', async () => {
    mount();
    await screen.findByRole('option', { name: /PQT-000305/ });
    select();
    await screen.findByText(/2 líneas del paquete disponibles/);
    expect(snapshot().lines).toEqual([]);
    const button = continueButton();
    fireEvent.click(button);
    fireEvent.click(button);
    const draft = snapshot();
    expect(draft.lines).toHaveLength(2);
    expect(new Set(draft.lines.map((line) => line.localId)).size).toBe(2);
    expect(draft.lines[0]).toMatchObject({
      source: 'agreement',
      matchingAgreementLine: 7001,
      quantity: 12.5,
      price: 31.7,
      siteId: 'S-PACK',
      warehouseId: 'W-PACK',
      presentationCode: 'VAR-PACK',
      dimensions: {
        configId: 'CFG',
        colorId: 'VERDE',
        sizeId: 'GRANDE',
        styleId: 'ESTILO',
        versionId: 'V2',
      },
      promotion: null,
      isBonification: false,
    });
    expect(draft.lines[1]).toMatchObject({ matchingAgreementLine: 7002, quantity: 6, price: 8.25 });
    expect(mapHeaderRequest(draft)).toMatchObject({
      MatchingAgreement: 305,
      CSFASalesAgreementId: 'PQT-000305',
    });
    expect(mapAgreementLineRequest(draft, draft.lines[0], 'OV-1')).toMatchObject({
      MatchingAgreementLine: 7001,
      OrderedSalesQuantity: 12.5,
      SalesPrice: 31.7,
      ProductConfigurationId: 'CFG',
      ShippingWarehouseId: 'W-PACK',
    });
    expect(screen.getByTestId('location')).toHaveTextContent('/crear-pedido/revision');
    expect(mocks.details).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledWith(
      '/customer/agreement/parcial_lines',
      { company: 'CO', account_id: 'C1', recid: 305 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mocks.post.mock.calls.some(([path]) => path === '/d365_services/get_price')).toBe(false);
  });
  it('sends package lines through the existing runner and agreement gateway with idempotency keys', async () => {
    mount();
    await screen.findByRole('option', { name: /PQT-000305/ });
    select();
    await screen.findByText(/2 líneas del paquete disponibles/);
    fireEvent.click(continueButton());
    const draft = snapshot();
    const gateway = {
      createHeader: vi.fn().mockResolvedValue({ salesOrderNumber: 'OV-PACK' }),
      createAgreementLine: vi.fn().mockResolvedValue([]),
      createNormalLine: vi.fn(),
      getExistingLines: vi.fn().mockResolvedValue([]),
    };
    const result = await new SubmissionRunner(gateway).submit(draft);
    expect(result.completed).toBe(true);
    expect(gateway.createNormalLine).not.toHaveBeenCalled();
    expect(gateway.createAgreementLine).toHaveBeenCalledTimes(2);
    expect(gateway.createAgreementLine).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        MatchingAgreementLine: 7001,
        SalesOrderNumber: 'OV-PACK',
        SalesPrice: 31.7,
      }),
      expect.any(String),
    );
    expect(gateway.createAgreementLine.mock.calls[0][1]).not.toBe(
      gateway.createAgreementLine.mock.calls[1][1],
    );
  });
  it('blocks continuation during loading and replaces old lines when changing packages', async () => {
    let release!: (value: unknown) => void;
    mocks.details.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    mount(validDraft());
    await screen.findByRole('option', { name: /PQT-000305/ });
    select();
    expect(snapshot().lines).toEqual([]);
    expect(screen.getByText('Cargando líneas del paquete...')).toBeInTheDocument();
    expect(continueButton()).toBeDisabled();
    select('306');
    await screen.findByText(/1 líneas del paquete disponibles/);
    await act(async () => {
      release({ parcial_lines: rows });
    });
    expect(snapshot().agreement?.recId).toBe(306);
    fireEvent.click(continueButton());
    expect(snapshot().lines).toHaveLength(1);
    expect(snapshot().lines[0]).toMatchObject({ matchingAgreementLine: 8001, price: 19 });
  });
  it('discards stale package data and references when changing the customer', async () => {
    mount();
    await screen.findByRole('option', { name: /PQT-000305/ });
    select();
    await screen.findByText(/2 líneas del paquete disponibles/);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    fireEvent.change(screen.getByLabelText('Buscar por cuenta o nombre'), {
      target: { value: 'C2' },
    });
    fireEvent.click(
      await screen.findByRole('button', { name: /Otro cliente.*C2/ }, { timeout: 2500 }),
    );
    expect(snapshot().customer?.account).toBe('C2');
    expect(snapshot().agreement).toBeNull();
    expect(snapshot().lines).toEqual([]);
    expect(snapshot().deliveryAddress).toBeNull();
    expect(continueButton()).toBeDisabled();
  });
  it('clears package selection and returns to the manual flow when the agreement is removed', async () => {
    mount();
    await screen.findByRole('option', { name: /PQT-000305/ });
    select();
    await screen.findByText(/2 líneas del paquete disponibles/);
    select('');
    expect(snapshot().agreement).toBeNull();
    expect(snapshot().lines).toEqual([]);
    fireEvent.click(continueButton());
    expect(screen.getByTestId('location')).toHaveTextContent('/crear-pedido/linea');
  });
  it('reports detail errors without general-price fallback or an automatic retry and allows an explicit query retry', async () => {
    mocks.details.mockRejectedValueOnce(new Error('offline'));
    mount();
    await screen.findByRole('option', { name: /PQT-000305/ });
    select();
    await screen.findByText('No se pudieron consultar las líneas del paquete.');
    expect(continueButton()).toBeDisabled();
    expect(snapshot().lines).toEqual([]);
    expect(mocks.details).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Intentar nuevamente' }));
    await screen.findByText(/2 líneas del paquete disponibles/);
    expect(mocks.details).toHaveBeenCalledTimes(2);
  });
  it('blocks empty packages rather than opening manual lines with a package header', async () => {
    mocks.details.mockResolvedValue({ parcial_lines: [] });
    mount();
    await screen.findByRole('option', { name: /PQT-000305/ });
    select();
    await screen.findByRole('alert');
    expect(screen.getByText('El paquete no tiene líneas disponibles.')).toBeInTheDocument();
    expect(continueButton()).toBeDisabled();
    expect(snapshot().lines).toEqual([]);
  });
  it('prevents duplicate agreement references through the provider even on repeated local additions', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir referencia de prueba' }));
    fireEvent.click(screen.getByRole('button', { name: 'Añadir referencia de prueba' }));
    expect(snapshot().lines).toHaveLength(1);
    expect(snapshot().lines[0].matchingAgreementLine).toBe(7001);
  });
});

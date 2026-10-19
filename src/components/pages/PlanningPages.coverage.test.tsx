import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForecastRow, ForecastFilters } from '../../features/forecast/forecastTypes';
import type {
  DailyProduction,
  SalesProduction,
  ProductionFilters,
} from '../../features/production/productionTypes';
import ForecastPage from './ForecastPage';
import ProductionPage from './ProductionPage';
const mocks = vi.hoisted(() => ({ forecast: vi.fn(), production: vi.fn(), retry: vi.fn() }));
vi.mock('../../features/forecast/forecastQueries', () => ({
  useForecast: (...args: unknown[]) => mocks.forecast(...args),
}));
vi.mock('../../features/production/productionQueries', () => ({
  useProduction: (...args: unknown[]) => mocks.production(...args),
}));
const row: ForecastRow = {
  salesGroup: 'V1',
  salesGroupName: 'Ventas',
  customer: 'C1',
  itemId: 'I1',
  variant: 'VAR',
  salesQuantity: 0,
  salesAmount: null,
  salesVolume: null,
  budgetQuantity: 12,
  budgetAmount: null,
  budgetVolume: null,
  projectionQuantity: 18,
  projectionAmount: null,
  projectionVolume: null,
};
const order: SalesProduction = {
  companyId: 'CO',
  salesGroup: 'V1',
  customer: 'Cliente',
  salesStatus: 'Orden Abierta',
  salesId: 'OV-1',
  productionId: 'PR-1',
  itemId: 'I1',
  bomId: 'B1',
  productionStatus: 4,
  poolId: '',
  name: 'Semillas',
  scheduledQuantity: 15,
  backorderStatus: 'Pendiente',
};
const daily: DailyProduction = {
  productionId: 'PR-2',
  started: '2026-10-01',
  finished: '2026-10-02',
  area: 'A1',
  bomId: 'B2',
  quantity: 20,
  itemId: 'I2',
  type: 'Producto',
  status: 'Terminado',
  description: 'Fertilizante',
  presentation: 1,
  kiloliters: 4,
  activeIngredient: '',
  line: 'L1',
  customerAccount: 'C2',
  destination: 'GTM',
  customerName: 'Cliente diario',
  country: 'GTM',
  year: 2026,
  month: 10,
};
const query = (items: unknown[], page = 1) => ({
  data: { items, pagination: { currentPage: page, totalPages: 2, totalRecords: 2 } },
  isLoading: false,
  isError: false,
  refetch: mocks.retry,
});
const Location = () => <output data-testid="location">{useLocation().search}</output>;
const mount = (element: React.ReactNode, search = '') =>
  render(
    <MemoryRouter initialEntries={['/' + search]}>
      {element}
      <Location />
    </MemoryRouter>,
  );
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.retry.mockResolvedValue(undefined);
  mocks.forecast.mockImplementation((f: ForecastFilters) => query([row], f.page));
  mocks.production.mockImplementation((f: ProductionFilters) =>
    query(f.mode === 'orders' ? [order] : [daily], f.page),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe.each(['forecast', 'production'])('%s query feedback', (kind) => {
  const element = () => (kind === 'forecast' ? <ForecastPage /> : <ProductionPage />);
  const hook = () => (kind === 'forecast' ? mocks.forecast : mocks.production);
  it.each(['loading', 'error', 'empty', 'absent'])(
    'shows %s without a misleading table',
    (state) => {
      const value = query([]);
      hook().mockReturnValue({
        ...value,
        data: state === 'absent' ? undefined : value.data,
        isLoading: state === 'loading',
        isError: state === 'error',
      });
      mount(element());
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      if (state === 'loading') expect(screen.getByText('Cargando...')).toBeInTheDocument();
      if (state === 'error')
        expect(screen.getByRole('button', { name: 'Intentar nuevamente' })).toBeInTheDocument();
      if (state === 'empty' || state === 'absent')
        expect(screen.getByText(/No hay (forecast|registros de producción)/)).toBeInTheDocument();
    },
  );
  it('handles an explicit failed refresh once', async () => {
    hook().mockReturnValue({ ...query([]), isError: true });
    mocks.retry.mockRejectedValue(new Error('offline'));
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    mount(element());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Intentar nuevamente' }));
    });
    expect(mocks.retry).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(1);
  });
});

describe('ForecastPage filters and persisted values', () => {
  it('displays recorded zero quantities and falls back to amount, volume and unavailable values', () => {
    mocks.forecast.mockReturnValue(
      query([
        row,
        {
          ...row,
          itemId: 'I2',
          salesQuantity: null,
          salesAmount: 40,
          budgetQuantity: null,
          budgetAmount: 50,
          projectionQuantity: null,
          projectionAmount: 60,
        },
        {
          ...row,
          itemId: 'I3',
          salesQuantity: null,
          salesVolume: 2,
          budgetQuantity: null,
          budgetVolume: 3,
          projectionQuantity: null,
          projectionVolume: 4,
        },
        {
          ...row,
          itemId: 'I4',
          salesQuantity: null,
          budgetQuantity: null,
          projectionQuantity: null,
        },
      ]),
    );
    mount(<ForecastPage />);
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(within(rows[1]).getByText('0')).toBeInTheDocument();
    expect(within(rows[2]).getByText('40')).toBeInTheDocument();
    expect(within(rows[3]).getByText('2')).toBeInTheDocument();
    expect(within(rows[4]).getAllByText('—')).toHaveLength(3);
  });
  it.each([
    ['', ''],
    ['2026-10-01', ''],
    ['', '2026-10-02'],
    ['2026-10-03', '2026-10-02'],
  ])('blocks missing or reversed date range %s/%s', (from, to) => {
    mount(<ForecastPage />);
    change('Desde', from);
    change('Hasta', to);
    expect(screen.getByRole('button', { name: 'Consultar' })).toBeDisabled();
  });
  it('applies all fields only on Consultar and paginates with the same filters', () => {
    mount(<ForecastPage />);
    for (const [label, value] of [
      ['Desde', '2026-10-01'],
      ['Hasta', '2026-10-02'],
      ['Producto', 'I2'],
      ['Variante', 'AZUL'],
      ['Cliente', 'C2'],
      ['Métrica', 'amount'],
    ])
      change(label, value);
    expect(mocks.forecast.mock.lastCall![0].item).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    const expected = {
      from: '2026-10-01',
      to: '2026-10-02',
      item: 'I2',
      variant: 'AZUL',
      customer: 'C2',
      view: 'amount',
      page: 1,
    };
    expect(mocks.forecast).toHaveBeenLastCalledWith(expected);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(mocks.forecast).toHaveBeenLastCalledWith({ ...expected, page: 2 });
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(mocks.forecast).toHaveBeenLastCalledWith(expected);
  });
  it('preserves URL filters and omits optional blanks when applying', () => {
    mount(<ForecastPage />, '?from=2026-10-01&to=2026-10-02&view=volume&page=2');
    expect(screen.getByLabelText('Métrica')).toHaveValue('volume');
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(screen.getByTestId('location')).toHaveTextContent('view=volume&page=1');
    expect(screen.getByTestId('location')).not.toHaveTextContent('customer=');
  });
});

describe('ProductionPage modes and filters', () => {
  it.each(['orders', 'daily'])('renders the actual %s columns and fields', (mode) => {
    mount(<ProductionPage />, '?mode=' + mode);
    const table = screen.getByRole('table');
    if (mode === 'orders') {
      expect(within(table).getByText('OV-1')).toBeInTheDocument();
      expect(within(table).getByText('Semillas')).toBeInTheDocument();
      expect(within(table).getByText('Código 4')).toBeInTheDocument();
    } else {
      expect(within(table).getByText('PR-2')).toBeInTheDocument();
      expect(within(table).getByText('2026-10-01')).toBeInTheDocument();
      expect(within(table).getByText('4')).toBeInTheDocument();
      expect(screen.queryByLabelText('Cliente')).not.toBeInTheDocument();
    }
  });
  it('validates dates, applies every order filter and paginates without losing them', () => {
    mount(<ProductionPage />);
    for (const [label, value] of [
      ['Producto', 'I1'],
      ['Cliente', 'C1'],
      ['Estado del pedido', 'Entregado'],
      ['Desde', '2026-10-03'],
      ['Hasta', '2026-10-02'],
      ['Fecha de despacho', '2026-10-04'],
    ])
      change(label, value);
    expect(screen.getByRole('button', { name: 'Consultar' })).toBeDisabled();
    change('Hasta', '2026-10-05');
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    const expected = {
      mode: 'orders',
      item: 'I1',
      customer: 'C1',
      status: 'Entregado',
      from: '2026-10-03',
      to: '2026-10-05',
      delivery: '2026-10-04',
      page: 1,
    };
    expect(mocks.production).toHaveBeenLastCalledWith(expected);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(mocks.production).toHaveBeenLastCalledWith({ ...expected, page: 2 });
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(mocks.production).toHaveBeenLastCalledWith(expected);
  });
  it('switches to daily mode, hides sales filters and omits blank optional fields', () => {
    mount(<ProductionPage />);
    change('Vista', 'daily');
    expect(screen.queryByLabelText('Fecha de despacho')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(mocks.production.mock.lastCall![0]).toMatchObject({
      mode: 'daily',
      page: 1,
      customer: '',
    });
    expect(screen.getByTestId('location')).toHaveTextContent('?mode=daily&page=1');
    expect(screen.getByText('Fertilizante')).toBeInTheDocument();
  });
});

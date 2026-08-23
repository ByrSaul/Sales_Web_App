import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ production: vi.fn(), forecast: vi.fn() }));
vi.mock('../../features/production/productionQueries', () => ({
  useProduction: (f: unknown) => mocks.production(f),
}));
vi.mock('../../features/forecast/forecastQueries', () => ({
  useForecast: (f: unknown) => mocks.forecast(f),
}));
import ProductionPage from './ProductionPage';
import ForecastPage from './ForecastPage';
afterEach(cleanup);
describe('production and forecast pages', () => {
  it('restores production URL filters and renders real empty state', () => {
    mocks.production.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [], pagination: {} },
    });
    render(
      <MemoryRouter initialEntries={['/produccion?mode=daily&item=I1&page=2']}>
        <ProductionPage />
      </MemoryRouter>,
    );
    expect(mocks.production).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'daily', item: 'I1', page: 2 }),
    );
    expect(
      screen.getByText('No hay registros de producción para estos filtros'),
    ).toBeInTheDocument();
  });
  it('restores forecast URL filters and renders error state', () => {
    mocks.forecast.mockReturnValue({ isLoading: false, isError: true, refetch: vi.fn() });
    render(
      <MemoryRouter initialEntries={['/forecast?from=2026-01-01&to=2026-12-31&view=volume&page=2']}>
        <ForecastPage />
      </MemoryRouter>,
    );
    expect(mocks.forecast).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-01-01', view: 'volume', page: 2 }),
    );
    expect(screen.getByText('No se pudo consultar el forecast.')).toBeInTheDocument();
  });
});

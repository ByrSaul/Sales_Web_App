import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../core/api/apiClient';
import { forecastKey } from './forecastQueries';
import { forecastService, mapForecast } from './forecastService';
import type { ForecastFilters } from './forecastTypes';
const filters: ForecastFilters = {
  from: '2026-01-01',
  to: '2026-12-31',
  item: 'I',
  variant: 'V1',
  customer: 'C',
  view: 'amount',
  page: 3,
};
describe('forecast', () => {
  it('sends exact Backend forecast contract', async () => {
    const post = vi.fn().mockResolvedValue({ forecastsales: [], pagination: {} });
    await forecastService({ post } as unknown as ApiClient).list('CO', 'VEN', filters);
    expect(post).toHaveBeenCalledWith(
      '/forecastSales',
      {
        company: 'CO',
        salesgroup: 'VEN',
        from_date: '2026-01-01',
        to_date: '2026-12-31',
        itemid: 'I',
        variant: 'V1',
        customerid: 'C',
        view_result_by: 'amount',
        pagination: { perpage: 20, page: 3 },
      },
      { signal: undefined },
    );
  });
  it('maps only metrics returned for selected view', () =>
    expect(
      mapForecast({ itemid: 'I', ventaamount: 10.25, presupuestoamount: 20, proyeccionamount: 15 }),
    ).toMatchObject({
      itemId: 'I',
      salesAmount: 10.25,
      budgetAmount: 20,
      projectionAmount: 15,
      salesQuantity: null,
    }));
  it('keeps quantity, amount and volume distinct', () =>
    expect(mapForecast({ ventaqty: 1, ventaamount: 2, ventavolume: 3 })).toMatchObject({
      salesQuantity: 1,
      salesAmount: 2,
      salesVolume: 3,
    }));
  it('segregates company and every forecast filter', () =>
    expect(forecastKey('CO', 'VEN', filters)).toEqual([
      'forecast',
      'CO',
      'VEN',
      '2026-01-01',
      '2026-12-31',
      'I',
      'V1',
      'C',
      'amount',
      3,
    ]));
});

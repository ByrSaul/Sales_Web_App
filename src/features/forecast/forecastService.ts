import type { ApiClient } from '../../core/api/apiClient';
import type { ForecastFilters, ForecastRow } from './forecastTypes';
type J = Record<string, unknown>;
const s = (v: unknown) => (v == null ? '' : String(v)),
  maybe = (v: unknown) => (v == null ? null : typeof v === 'number' ? v : Number(v) || 0);
/** Convierte una fila sin tipar del API en una fila de pronóstico de dominio. */
export const mapForecast = (j: J): ForecastRow => ({
  salesGroup: s(j.commisssalesgroup),
  salesGroupName: s(j.commissionsalesgroupname),
  customer: s(j.custaccountid),
  itemId: s(j.itemid),
  variant: s(j.fadisplayproductnumber),
  salesQuantity: maybe(j.ventaqty),
  salesAmount: maybe(j.ventaamount),
  salesVolume: maybe(j.ventavolume),
  budgetQuantity: maybe(j.presupuestoqty),
  budgetAmount: maybe(j.presupuestoamount),
  budgetVolume: maybe(j.presupuestovolume),
  projectionQuantity: maybe(j.proyeccionqty),
  projectionAmount: maybe(j.proyeccionamount),
  projectionVolume: maybe(j.proyeccionvolume),
});
/**
 * Servicio de consulta del pronóstico comercial.
 *
 * Endpoints utilizados:
 * - `POST /forecast`
 *
 * @param api Cliente HTTP autenticado.
 * @returns Operación paginada de consulta de pronóstico.
 */
export const forecastService = (api: ApiClient) => ({
  list: async (company: string, vendor: string, f: ForecastFilters, signal?: AbortSignal) => {
    const value = await api.post<J>(
      '/forecastSales',
      {
        company,
        salesgroup: vendor,
        from_date: f.from || '1990-01-01',
        to_date: f.to || '1990-01-01',
        itemid: f.item,
        variant: f.variant,
        customerid: f.customer,
        view_result_by: f.view,
        pagination: { perpage: 20, page: f.page },
      },
      { signal },
    );
    const p = (value.pagination ?? {}) as J;
    return {
      items: Array.isArray(value.forecastsales)
        ? value.forecastsales.map((x) => mapForecast(x as J))
        : [],
      pagination: {
        currentPage: Number(p.CurrentPage ?? 1),
        totalPages: Number(p.TotalPages ?? 1),
        totalRecords: Number(p.TotalRecords ?? 0),
      },
    };
  },
});

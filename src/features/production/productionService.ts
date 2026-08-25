import type { ApiClient } from '../../core/api/apiClient';
import type {
  DailyProduction,
  Pagination,
  ProductionFilters,
  SalesProduction,
} from './productionTypes';
type J = Record<string, unknown>;
const s = (v: unknown) => (v == null ? '' : String(v)),
  n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const pagination = (j: J): Pagination => ({
  currentPage: n(j.CurrentPage ?? j.current_page) || 1,
  perPage: n(j.PerPage ?? j.perpage) || 20,
  totalPages: n(j.TotalPages ?? j.total_pages) || 1,
  totalRecords: n(j.TotalRecords ?? j.total_records),
});
/** Convierte una orden de producción del API al modelo presentado por la Web. */
export const mapSalesProduction = (j: J): SalesProduction => ({
  companyId: s(j.dataareaid),
  salesGroup: s(j.salesgroup),
  customer: s(j.custaccount),
  salesStatus: s(j.salesstatus),
  salesId: s(j.salesid),
  productionId: s(j.ProdId),
  itemId: s(j.itemid),
  bomId: s(j.bomid),
  productionStatus: n(j.prodstatus),
  poolId: s(j.prodpoolid),
  name: s(j.name),
  scheduledQuantity: n(j.qtysched),
  backorderStatus: s(j.backorderstatus),
});
/** Convierte un resumen diario del API al modelo de producción diaria. */
export const mapDailyProduction = (j: J): DailyProduction => ({
  started: s(j.iniciado),
  finished: s(j.terminado),
  area: s(j.area),
  productionId: s(j.orden),
  bomId: s(j.codigo),
  quantity: n(j.cantidad),
  itemId: s(j.itemid),
  type: s(j.tipo),
  status: s(j.estatus),
  description: s(j.descripcion),
  presentation: n(j.presentacion),
  kiloliters: n(j.kilolitros),
  activeIngredient: s(j.ingactivo),
  line: s(j.linea),
  customerAccount: s(j.cuenta),
  destination: s(j.destino),
  customerName: s(j.cliente),
  country: s(j.pais),
  year: n(j.anio),
  month: n(j.mes),
});
/**
 * Servicio de consulta de producción por pedido y por fecha.
 *
 * Endpoints utilizados:
 * - Endpoints de producción seleccionados según el modo de consulta.
 *
 * @param api Cliente HTTP autenticado.
 * @returns Operación paginada de consulta de producción.
 */
export const productionService = (api: ApiClient) => ({
  list: async (company: string, vendor: string, f: ProductionFilters, signal?: AbortSignal) => {
    const body = {
      company,
      cust_id: f.customer,
      item_id: f.item,
      sales_group: vendor,
      from_date: f.from || '1990-01-01',
      to_date: f.to || '1990-01-01',
      sales_status: f.status || 'None',
      deliverydate: f.delivery || '1990-01-01',
      pagination: { perpage: 20, page: f.page },
    };
    const value = await api.post<J>(
      f.mode === 'daily' ? '/production/daily' : '/production',
      body,
      { signal },
    );
    return {
      items: Array.isArray(value.production)
        ? value.production.map((x) =>
            f.mode === 'daily' ? mapDailyProduction(x as J) : mapSalesProduction(x as J),
          )
        : [],
      pagination: pagination((value.pagination ?? {}) as J),
    };
  },
});

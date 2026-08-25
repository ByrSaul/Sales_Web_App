import type { ApiClient } from '../../core/api/apiClient';
import {
  mapCancel,
  mapConfirmation,
  mapOfficialOrderLines,
  mapOrders,
} from './orderMappers';
import type { OrderFilters, UpdateLineInput } from './orderTypes';
/**
 * Servicio de consulta y mantenimiento de pedidos existentes.
 *
 * Endpoints utilizados:
 * - Endpoints D365 de consulta, confirmación y cancelación de pedidos.
 * - Endpoints D365 de actualización, cancelación y eliminación de líneas.
 *
 * @param api Cliente HTTP autenticado.
 * @returns Operaciones sobre pedidos y líneas persistidas.
 */
export const orderQueryService = (api: ApiClient) => ({
  async list(company: string, salesGroup: string, filters: OrderFilters, signal?: AbortSignal) {
    return mapOrders(
      await api.post<unknown>(
        '/sales',
        {
          company,
          ...(filters.customer ? { cust_id: filters.customer } : {}),
          sales_group: salesGroup,
          ...(filters.from ? { from_date: filters.from } : {}),
          ...(filters.to ? { to_date: filters.to } : {}),
          ...(filters.status ? { sales_status: filters.status } : {}),
          ...(filters.creditControl ? { credit_control: filters.creditControl } : {}),
          pagination: { perpage: filters.perPage, page: filters.page },
        },
        { signal },
      ),
      filters.perPage,
    );
  },
  async header(company: string, salesOrderNumber: string, signal?: AbortSignal) {
    const result = mapOrders(
      await api.post<unknown>(
        '/sales',
        { company, sales_id: salesOrderNumber, pagination: { perpage: 1, page: 1 } },
        { signal },
      ),
      1,
    );
    return result.items[0] ?? null;
  },
  async lines(company: string, salesOrderNumber: string, signal?: AbortSignal) {
    return mapOfficialOrderLines(
      await api.post<unknown>(
        '/d365/sales/line/query',
        {
          filters: {
            dataAreaId: [company],
            SalesOrderNumber: [salesOrderNumber],
          },
          cross_company: true,
          page: 1,
          perpage: 1000,
        },
        { signal },
      ),
    );
  },
  async officialLine(
    company: string,
    salesOrderNumber: string,
    lineNumber: number,
    signal?: AbortSignal,
  ) {
    const result = mapOfficialOrderLines(
      await api.post<unknown>(
        '/d365/sales/line/query',
        {
          filters: {
            dataAreaId: [company],
            SalesOrderNumber: [salesOrderNumber],
            LineNumber: lineNumber,
          },
          cross_company: true,
          page: 1,
          perpage: 25,
        },
        { signal },
      ),
    );
    const matches = result.filter(
      (line) =>
        line.dataAreaId.trim().toLowerCase() === company.trim().toLowerCase() &&
        line.salesOrderNumber.trim().toLowerCase() === salesOrderNumber.trim().toLowerCase() &&
        line.lineNumber === lineNumber,
    );
    if (!matches.length) throw new Error('No se encontrÃ³ la lÃ­nea seleccionada en Dynamics.');
    if (matches.length !== 1)
      throw new Error('Dynamics devolviÃ³ mÃ¡s de una coincidencia para la lÃ­nea seleccionada.');
    return matches[0];
  },
  async updateLine(input: UpdateLineInput) {
    return api.patch<unknown>(
      '/d365/sales/line',
      {
        key: { dataAreaId: input.companyId, InventoryLotId: input.inventoryLotId },
        payload:
          input.payload ?? {
            ...(input.quantity !== undefined ? { OrderedSalesQuantity: input.quantity } : {}),
            ...(input.price !== undefined ? { SalesPrice: input.price } : {}),
          },
      },
      { timeoutMs: 60_000 },
    );
  },
  async cancelLine(companyId: string, inventoryLotId: string) {
    return mapCancel(
      await api.post<unknown>(
        '/d365_services/post_cancle_sales_line',
        { dataAreaId: companyId, InventoryLotId: inventoryLotId },
        { timeoutMs: 60_000, retryOnUnauthorized: false },
      ),
    );
  },
  async deleteLine(companyId: string, inventoryLotId: string) {
    return api.delete<unknown>(
      '/d365/sales/line',
      { key: { dataAreaId: companyId, InventoryLotId: inventoryLotId } },
      { timeoutMs: 60_000, retryOnUnauthorized: false },
    );
  },
  async confirm(companyId: string, salesOrderNumber: string) {
    return mapConfirmation(
      await api.post<unknown>(
        '/d365_services/confirm_sales_order',
        { DataAreaId: companyId, SalesId: salesOrderNumber },
        { timeoutMs: 60_000 },
      ),
    );
  },
});

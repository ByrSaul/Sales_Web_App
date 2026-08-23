import type { ApiClient } from '../../core/api/apiClient';
import { mapCancel, mapConfirmation, mapOrderLines, mapOrders } from './orderMappers';
import type { OrderFilters, UpdateLineInput } from './orderTypes';
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
    return mapOrderLines(
      await api.post<unknown>(
        '/sales/details',
        { company, sales_id: salesOrderNumber },
        { signal },
      ),
    );
  },
  async updateLine(input: UpdateLineInput) {
    return api.patch<unknown>(
      '/d365/sales/line',
      {
        key: { dataAreaId: input.companyId, InventoryLotId: input.inventoryLotId },
        payload: { OrderedSalesQuantity: input.quantity, SalesPrice: input.price },
      },
      { timeoutMs: 60_000 },
    );
  },
  async cancelLine(companyId: string, inventoryLotId: string) {
    return mapCancel(
      await api.post<unknown>(
        '/d365_services/post_cancle_sales_line',
        { dataAreaId: companyId, InventoryLotId: inventoryLotId },
        { timeoutMs: 60_000 },
      ),
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

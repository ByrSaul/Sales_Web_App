import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../core/api/apiClient';
import type { MenuPermission } from '../../core/session/types';
import { mapConfirmation, mapOrderLines, mapOrders, statusLabel } from './orderMappers';
import { orderKeys } from './orderQueries';
import { canCancelOrderLine, canConfirmOrder, canEditOrderLine, canEditPrice } from './orderRules';
import { orderQueryService } from './orderQueryService';
import type { ExistingOrder, ExistingOrderLine, OrderFilters } from './orderTypes';
const filters: OrderFilters = {
  customer: 'C1',
  status: 'Orden Abierta',
  creditControl: 'Si',
  from: '2026-08-01',
  to: '2026-08-22',
  page: 2,
  perPage: 10,
};
const order: ExistingOrder = {
  companyId: 'CO',
  salesOrderNumber: 'OV',
  currencyCode: 'GTQ',
  createdDate: '',
  deliveryDate: '',
  status: 'Orden Abierta',
  customerAccount: 'C',
  customerName: 'N',
  salesGroup: 'V',
  paymentTerms: '',
  creditManagement: '',
  creditStatus: '',
  salesAmount: 10,
  address: '',
  confirmDocumentNumber: '',
  observations: '',
  customerReference: '',
  matchingAgreement: null,
  agreementId: '',
};
const line: ExistingOrderLine = {
  lineNumber: 1,
  itemId: 'I',
  displayProductNumber: 'I',
  quantity: 1.5,
  lineAmount: 15,
  price: 10,
  itemName: 'Item',
  inventoryLotId: 'LOT',
  status: 'Orden Abierta',
  isBonification: false,
  matchingAgreementLine: null,
};
describe('existing order mapping and rules', () => {
  it('parses real paginated list response', () => {
    const result = mapOrders({
      sales_orders: [
        { dataareaid: 'CO', salesid: 'OV', salesstatus: 'Orden Abierta', salesamount: 12.5 },
      ],
      pagination: { CurrentPage: 2, TotalPages: 4, TotalRecords: 31, PerPage: 10 },
    });
    expect(result.items[0]).toMatchObject({
      companyId: 'CO',
      salesOrderNumber: 'OV',
      status: 'Orden Abierta',
      salesAmount: 12.5,
    });
    expect(result.pagination).toMatchObject({ currentPage: 2, totalPages: 4, totalRecords: 31 });
  });
  it('parses POST details without inventing unavailable fields', () => {
    const [result] = mapOrderLines([
      { linenum: 2, itemid: 'I', salesqty: 1.5, lineamount: 15, salesprice: 10, item_name: 'Item' },
    ]);
    expect(result.quantity).toBe(1.5);
    expect(result.inventoryLotId).toBe('');
    expect(result.status).toBe('');
  });
  it('translates only confirmed Dynamics statuses', () => {
    expect(statusLabel('Backorder')).toBe('Orden Abierta');
    expect(statusLabel('Custom')).toBe('Custom');
  });
  it('distinguishes accepted, pending confirmation', () => {
    expect(
      mapConfirmation({ Success: true, confirmed: false, DebugMessage: 'pending' }),
    ).toMatchObject({ success: true, confirmed: false, debugMessage: 'pending' });
  });
  it('allows line mutation only for open, non-invoiced lines with InventoryLotId', () => {
    expect(canEditOrderLine(order, line)).toBe(true);
    expect(canCancelOrderLine(order, { ...line, inventoryLotId: '' })).toBe(false);
    expect(canEditOrderLine(order, { ...line, status: 'Invoiced' })).toBe(false);
  });
  it('allows confirmation only for open unconfirmed orders with lines', () => {
    expect(canConfirmOrder(order, [line])).toBe(true);
    expect(canConfirmOrder({ ...order, confirmDocumentNumber: 'DOC' }, [line])).toBe(false);
    expect(canConfirmOrder(order, [])).toBe(false);
  });
  it('uses the exact nested price permission', () => {
    const permissions: MenuPermission[] = [
      {
        menu: 'Create Sales Orders',
        company: 'CO',
        permissionLevel: '',
        children: [
          { menu: 'Price Sales Line', company: 'CO', permissionLevel: 'Editar', children: [] },
        ],
      },
    ];
    expect(canEditPrice(permissions)).toBe(true);
    expect(canEditPrice([{ ...permissions[0], children: [] }])).toBe(false);
  });
  it('segregates query keys by company, vendor and filters', () => {
    expect(orderKeys.list('A', 'V', filters)).not.toEqual(orderKeys.list('B', 'V', filters));
    expect(orderKeys.list('A', 'V', filters)).not.toEqual(orderKeys.list('A', 'X', filters));
    expect(orderKeys.list('A', 'V', filters)).not.toEqual(
      orderKeys.list('A', 'V', { ...filters, page: 3 }),
    );
  });
});
describe('existing order service contracts', () => {
  const fake = () => ({ post: vi.fn(), patch: vi.fn() });
  it('sends list filters and pagination exactly', async () => {
    const api = fake();
    api.post.mockResolvedValue({ sales_orders: [], pagination: {} });
    await orderQueryService(api as unknown as ApiClient).list('CO', 'V', filters);
    expect(api.post).toHaveBeenCalledWith(
      '/sales',
      {
        company: 'CO',
        cust_id: 'C1',
        sales_group: 'V',
        from_date: '2026-08-01',
        to_date: '2026-08-22',
        sales_status: 'Orden Abierta',
        credit_control: 'Si',
        pagination: { perpage: 10, page: 2 },
      },
      { signal: undefined },
    );
  });
  it('loads direct header through POST /sales', async () => {
    const api = fake();
    api.post.mockResolvedValue({ sales_orders: [{ salesid: 'OV' }], pagination: {} });
    expect(
      (await orderQueryService(api as unknown as ApiClient).header('CO', 'OV'))?.salesOrderNumber,
    ).toBe('OV');
    expect(api.post).toHaveBeenCalledWith(
      '/sales',
      { company: 'CO', sales_id: 'OV', pagination: { perpage: 1, page: 1 } },
      { signal: undefined },
    );
  });
  it('uses POST /sales/details instead of incompatible GET-body', async () => {
    const api = fake();
    api.post.mockResolvedValue([]);
    await orderQueryService(api as unknown as ApiClient).lines('CO', 'OV');
    expect(api.post).toHaveBeenCalledWith(
      '/sales/details',
      { company: 'CO', sales_id: 'OV' },
      { signal: undefined },
    );
  });
  it('maps minimal PATCH payload and preserves decimal quantity', async () => {
    const api = fake();
    api.patch.mockResolvedValue([]);
    await orderQueryService(api as unknown as ApiClient).updateLine({
      companyId: 'CO',
      salesOrderNumber: 'OV',
      inventoryLotId: 'LOT',
      quantity: 1.5,
      price: 10,
    });
    expect(api.patch).toHaveBeenCalledWith(
      '/d365/sales/line',
      {
        key: { dataAreaId: 'CO', InventoryLotId: 'LOT' },
        payload: { OrderedSalesQuantity: 1.5, SalesPrice: 10 },
      },
      { timeoutMs: 60_000 },
    );
  });
  it('uses exact cancellation and confirmation payloads', async () => {
    const api = fake();
    api.post.mockResolvedValue({ Success: true });
    const service = orderQueryService(api as unknown as ApiClient);
    await service.cancelLine('CO', 'LOT');
    await service.confirm('CO', 'OV');
    expect(api.post).toHaveBeenNthCalledWith(
      1,
      '/d365_services/post_cancle_sales_line',
      { dataAreaId: 'CO', InventoryLotId: 'LOT' },
      { timeoutMs: 60_000 },
    );
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      '/d365_services/confirm_sales_order',
      { DataAreaId: 'CO', SalesId: 'OV' },
      { timeoutMs: 60_000 },
    );
  });
});

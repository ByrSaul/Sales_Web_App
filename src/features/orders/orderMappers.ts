import type { Pagination } from '../catalogs/types';
import type {
  CancelResult,
  ConfirmationResult,
  ExistingOrder,
  ExistingOrderLine,
  OrdersResult,
  SalesOrderStatus,
} from './orderTypes';
type Json = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v : '');
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const b = (v: unknown) => v === true;
export const mapOrder = (j: Json): ExistingOrder => ({
  companyId: s(j.dataareaid ?? j.dataAreaId),
  salesOrderNumber: s(j.salesid ?? j.SalesOrderNumber),
  currencyCode: s(j.currencycode ?? j.CurrencyCode),
  createdDate: s(j.createddate),
  deliveryDate: s(j.deliverydate),
  status: s(j.salesstatus ?? j.SalesOrderStatus),
  customerAccount: s(j.custaccount ?? j.InvoiceCustomerAccountNumber),
  customerName: s(j.custname ?? j.name),
  salesGroup: s(j.salesgroup),
  paymentTerms: s(j.payment),
  creditManagement: s(j.credmanincreditcontrol),
  creditStatus: s(j.credit_status),
  salesAmount: n(j.salesamount),
  address: s(j.address ?? j.FormattedDelveryAddress),
  confirmDocumentNumber: s(j.confirmdocnum),
  observations: s(j.observations ?? j.Observations),
  customerReference: s(j.customersorderreference ?? j.CustomersOrderReference),
  matchingAgreement: n(j.matchingagreement ?? j.MatchingAgreement) || null,
  agreementId: s(j.csfasalesagreementid ?? j.CSFASalesAgreementId),
});
const pagination = (j: Json, fallback = 10): Pagination => ({
  currentPage: n(j.CurrentPage ?? j.currentpage) || 1,
  perPage: n(j.PerPage ?? j.perpage) || fallback,
  fromRecord: n(j.FromRecord ?? j.fromrecord),
  toRecord: n(j.ToRecord ?? j.torecord),
  totalRecords: n(j.TotalRecords ?? j.totalrecords),
  totalPages: n(j.TotalPages ?? j.totalpages) || 1,
});
export const mapOrders = (raw: unknown, perPage = 10): OrdersResult => {
  if (Array.isArray(raw))
    return { items: raw.map((x) => mapOrder(x as Json)), pagination: pagination({}, perPage) };
  const j = raw && typeof raw === 'object' ? (raw as Json) : {};
  const list = Array.isArray(j.sales_orders) ? j.sales_orders : [];
  return {
    items: list.map((x) => mapOrder(x as Json)),
    pagination: pagination((j.pagination ?? {}) as Json, perPage),
  };
};
export const mapOrderLines = (raw: unknown): ExistingOrderLine[] =>
  (Array.isArray(raw) ? raw : []).map((x) => {
    const j = x as Json;
    const agreement = n(j.MatchingAgreementLine ?? j.matchingagreementline);
    return {
      lineNumber: n(j.LineNumber ?? j.linenum),
      itemId: s(j.ItemNumber ?? j.itemid),
      displayProductNumber: s(j.displayproductnumber ?? j.ItemNumber ?? j.itemid),
      quantity: n(j.OrderedSalesQuantity ?? j.salesqty),
      lineAmount: n(j.LineAmount ?? j.lineamount),
      price: n(j.SalesPrice ?? j.salesprice),
      itemName: s(j.LineDescription ?? j.item_name),
      inventoryLotId: s(j.InventoryLotId ?? j.inventorylotid),
      status: s(j.SalesOrderLineStatus ?? j.salesorderlinestatus),
      isBonification: !['', 'no', '0'].includes(s(j.FABonification).toLowerCase()),
      matchingAgreementLine: agreement || null,
    };
  });
export const mapConfirmation = (raw: unknown): ConfirmationResult => {
  const j = raw as Json;
  return {
    success: b(j.Success),
    confirmed: b(j.confirmed),
    errorMessage: s(j.ErrorMessage),
    debugMessage: s(j.DebugMessage),
    documentNumber: s(j.CustConfirmDocNum),
    sentToCreditManagement: b(j.sentToCreditManagement),
  };
};
export const mapCancel = (raw: unknown): CancelResult => {
  const j = raw as Json;
  return {
    success: b(j.Success),
    errorMessage: s(j.ErrorMessage),
    debugMessage: s(j.DebugMessage),
    salesOrderNumber: s(j.salesId),
  };
};
export const statusLabel = (status: SalesOrderStatus) =>
  Object.assign(Object.create(null) as Record<string, string>, {
    Backorder: 'Orden Abierta',
    Delivered: 'Entregado',
    Invoiced: 'Facturado',
    Canceled: 'Cancelado',
  })[status] ?? status;

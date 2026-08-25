import type { Pagination } from '../catalogs/types';
import type {
  CancelResult,
  ConfirmationResult,
  ExistingOrder,
  ExistingOrderLine,
  OfficialSalesOrderLine,
  OrdersResult,
  SalesOrderStatus,
} from './orderTypes';
type Json = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v : '');
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const b = (v: unknown) => v === true;
/** Convierte un encabezado de venta del API al modelo de pedido existente. */
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
  deliveryCountryRegionId: s(j.countryregionid ?? j.CountryRegionId),
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
/** Normaliza una respuesta paginada de pedidos y sus metadatos. */
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
/** Extrae las líneas resumidas incluidas en el detalle de un pedido. */
export const mapOrderLines = (raw: unknown): ExistingOrderLine[] =>
  (Array.isArray(raw) ? raw : []).map((x) => {
    const j = x as Json;
    const optionalString = (...keys: string[]) => {
      const key = keys.find((candidate) => candidate in j);
      return key === undefined ? undefined : s(j[key]) || undefined;
    };
    const agreement = n(j.MatchingAgreementLine ?? j.matchingagreementline);
    const hasAgreement = 'MatchingAgreementLine' in j || 'matchingagreementline' in j;
    const rawBonus = optionalString('FABonification', 'fabonification');
    return {
      lineNumber: n(j.LineNumber ?? j.linenum),
      itemId: s(j.ItemNumber ?? j.itemid),
      displayProductNumber: s(j.displayproductnumber ?? j.ItemNumber ?? j.itemid),
      quantity: n(j.OrderedSalesQuantity ?? j.salesqty),
      lineAmount: n(j.LineAmount ?? j.lineamount),
      price: n(j.SalesPrice ?? j.salesprice),
      itemName: s(j.LineDescription ?? j.item_name),
      inventoryLotId: optionalString('InventoryLotId', 'inventorylotid'),
      status: optionalString('SalesOrderLineStatus', 'salesorderlinestatus'),
      isBonification:
        rawBonus === undefined ? undefined : !['no', '0', 'false'].includes(rawBonus.toLowerCase()),
      matchingAgreementLine: hasAgreement ? agreement || null : undefined,
      shippingSiteId: optionalString('ShippingSiteId', 'shippingsiteid'),
      shippingWarehouseId: optionalString('ShippingWarehouseId', 'shippingwarehouseid'),
      configurationId: optionalString('ProductConfigurationId', 'productconfigurationid'),
      colorId: optionalString('ProductColorId', 'productcolorid'),
      sizeId: optionalString('ProductSizeId', 'productsizeid'),
      styleId: optionalString('ProductStyleId', 'productstyleid'),
      versionId: optionalString('ProductVersionId', 'productversionid'),
    };
  });
/** Convierte la consulta oficial de líneas al contrato utilizado para edición. */
export const mapOfficialOrderLines = (raw: unknown): OfficialSalesOrderLine[] =>
  (Array.isArray(raw) ? raw : []).map((x) => {
    const j = x as Json;
    const bonus = j.FABonification;
    const bonusText = String(bonus ?? '').trim().toLowerCase();
    return {
      dataAreaId: s(j.dataAreaId),
      salesOrderNumber: s(j.SalesOrderNumber),
      lineNumber: n(j.LineNumber),
      inventoryLotId: s(j.InventoryLotId),
      itemId: s(j.ItemNumber),
      itemName: s(j.LineDescription),
      quantity: n(j.OrderedSalesQuantity),
      price: n(j.SalesPrice),
      lineAmount: n(j.LineAmount),
      currencyCode: s(j.CurrencyCode),
      salesUnitSymbol: s(j.SalesUnitSymbol),
      status: s(j.SalesOrderLineStatus),
      isBonification:
        bonus === true || (!['', 'no', '0', 'false'].includes(bonusText) && Boolean(bonusText)),
      suppItemGroupId: s(j.CSFASuppItemGroupId),
      matchingAgreementLine: n(j.MatchingAgreementLine) || null,
      shippingSiteId: s(j.ShippingSiteId),
      shippingWarehouseId: s(j.ShippingWarehouseId),
      configurationId: s(j.ProductConfigurationId),
      colorId: s(j.ProductColorId),
      sizeId: s(j.ProductSizeId),
      styleId: s(j.ProductStyleId),
      versionId: s(j.ProductVersionId),
      lineDiscountPercentage: n(j.LineDiscountPercentage),
    };
  });
/** Normaliza el resultado devuelto al confirmar un pedido. */
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
/** Normaliza el resultado devuelto al cancelar un pedido o una línea. */
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

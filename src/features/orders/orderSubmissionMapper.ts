import type { OrderDraft, OrderDraftLine } from '../orderDraft/types';
import type {
  AgreementLineRequest,
  ExistingSalesLine,
  SalesHeaderRequest,
  SalesHeaderResponse,
  SalesLineRequest,
} from './types';
type Json = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v : '');
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const optionalText = (value: string | null | undefined) => value?.trim() || undefined;
/**
 * Traduce el borrador al contrato de creación del encabezado de venta.
 *
 * Flujo:
 * - Conserva compañía, idioma y datos comerciales.
 * - Usa el `personnelnumber` del usuario como responsable del pedido.
 * - Usa el grupo del vendedor seleccionado como grupo de comisión.
 *
 * @param d Borrador validado del pedido.
 * @returns Payload para `POST /d365/sales`.
 */
export const mapHeaderRequest = (d: OrderDraft): SalesHeaderRequest => {
  if (!d.languageId) {
    throw new Error('No se pudo determinar LanguageId del usuario ni del cliente seleccionado.');
  }
  const personnelnumber = d.personnelnumber?.trim();
  if (!personnelnumber) {
    throw new Error('No se pudo determinar el número de personal del usuario actual.');
  }
  const observations = optionalText(d.observations);
  const customerReference = optionalText(d.customerReference);
  const taxExemptNumber = optionalText(d.taxExemptNumber);
  const vendorId = optionalText(d.vendorId);
  return {
    dataAreaId: d.dataAreaId,
    CurrencyCode: d.currencyCode,
    LanguageId: d.languageId,
    InvoiceCustomerAccountNumber: d.customer?.account ?? '',
    OrderingCustomerAccountNumber: d.customer?.account ?? '',
    OrderResponsiblePersonnelNumber: personnelnumber,
    DeliveryAddressLocationId: d.deliveryAddress?.locationId ?? '',
    ...(d.deliveryMode ? { FADlvMode: d.deliveryMode.code } : {}),
    ...(d.requestedShippingDate
      ? {
          RequestedShippingDate: d.requestedShippingDate,
          ConfirmedShippingDate: d.requestedShippingDate,
        }
      : {}),
    ...(d.agreement
      ? { MatchingAgreement: d.agreement.recId, CSFASalesAgreementId: d.agreement.number }
      : {}),
    ...(vendorId ? { CommissionSalesRepresentativeGroupId: vendorId } : {}),
    ...(taxExemptNumber ? { TaxExemptNumber: taxExemptNumber } : {}),
    ...(d.salesOrigin ? { SalesOrderOriginCode: d.salesOrigin.id } : {}),
    ...(observations ? { Observations: observations } : {}),
    ...(customerReference ? { CustomersOrderReference: customerReference } : {}),
  };
};
const lineBase = (line: OrderDraftLine, order: string): Omit<SalesLineRequest, 'dataAreaId'> => ({
  SalesOrderNumber: order,
  ItemNumber: line.itemId,
  ProductConfigurationId: line.dimensions.configId,
  ProductStyleId: line.dimensions.styleId,
  ProductSizeId: line.dimensions.sizeId,
  ProductColorId: line.dimensions.colorId,
  ProductVersionId: line.dimensions.versionId,
  SalesPrice: line.price,
  OrderedSalesQuantity: line.quantity,
  ShippingSiteId: line.siteId,
  ShippingWarehouseId: line.warehouseId,
  ...(line.promotion ? { CSFASuppItemGroupId: line.promotion.groupId } : {}),
  FABonification: line.isBonification ? '1' : '0',
});
/** Construye el payload de una línea comercial normal. */
export const mapNormalLineRequest = (
  draft: OrderDraft,
  line: OrderDraftLine,
  order: string,
): SalesLineRequest => ({ ...lineBase(line, order), dataAreaId: draft.dataAreaId });
/** Construye el payload especializado de una línea proveniente de convenio. */
export const mapAgreementLineRequest = (
  draft: OrderDraft,
  line: OrderDraftLine,
  order: string,
): AgreementLineRequest => ({
  ...mapNormalLineRequest(draft, line, order),
  ChangeShippingWarehouseId: '',
  MatchingAgreementLine: line.matchingAgreementLine!,
});
/** Selecciona el endpoint de creación según el origen normal o de convenio de la línea. */
export const lineEndpoint = (line: OrderDraftLine) =>
  line.source === 'agreement' ? '/d365/sales/line/agreement' : '/d365/sales/line';
/** Normaliza la respuesta de creación del encabezado y extrae el número de pedido. */
export const mapHeaderResponse = (raw: unknown): SalesHeaderResponse => {
  const list = Array.isArray(raw) ? raw : [];
  const j = (list[0] ?? {}) as Json;
  return {
    dataAreaId: s(j.dataAreaId),
    salesOrderNumber: s(j.SalesOrderNumber),
    salesOrderName: s(j.SalesOrderName),
    salesOrderStatus: s(j.SalesOrderStatus),
    customerAccount: s(j.InvoiceCustomerAccountNumber),
    paymentTermsName: s(j.PaymentTermsName),
  };
};
/** Convierte una línea persistida de D365 al modelo usado para reconciliación. */
export const mapExistingLine = (j: Json): ExistingSalesLine => ({
  lineNumber: n(j.LineNumber),
  itemNumber: s(j.ItemNumber),
  productConfigurationId: s(j.ProductConfigurationId),
  productStyleId: s(j.ProductStyleId),
  productSizeId: s(j.ProductSizeId),
  productColorId: s(j.ProductColorId),
  productVersionId: s(j.ProductVersionId),
  salesPrice: n(j.SalesPrice),
  orderedSalesQuantity: n(j.OrderedSalesQuantity),
  shippingSiteId: s(j.ShippingSiteId),
  shippingWarehouseId: s(j.ShippingWarehouseId),
  csfaSuppItemGroupId: s(j.CSFASuppItemGroupId),
  faBonification: s(j.FABonification),
});
/** Extrae y mapea líneas persistidas desde las variantes conocidas de respuesta. */
export const mapExistingLines = (raw: unknown): ExistingSalesLine[] => {
  const value = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as Json)['@odata'])
      ? ((raw as Json)['@odata'] as unknown[])
      : [];
  return value.filter((v) => v && typeof v === 'object').map((v) => mapExistingLine(v as Json));
};
/** Determina si una línea local corresponde a una línea ya persistida. */
export const sameLine = (line: OrderDraftLine, existing: ExistingSalesLine) =>
  existing.itemNumber.toLowerCase() === line.itemId.toLowerCase() &&
  existing.productConfigurationId === line.dimensions.configId &&
  existing.productStyleId === line.dimensions.styleId &&
  existing.productSizeId === line.dimensions.sizeId &&
  existing.productColorId === line.dimensions.colorId &&
  existing.productVersionId === line.dimensions.versionId &&
  existing.salesPrice === line.price &&
  existing.orderedSalesQuantity === line.quantity &&
  existing.shippingSiteId === line.siteId &&
  existing.shippingWarehouseId === line.warehouseId &&
  existing.csfaSuppItemGroupId === (line.promotion?.groupId ?? '') &&
  ['yes', '1'].includes(existing.faBonification.toLowerCase()) === line.isBonification;
/** Verifica si una línea del borrador ya existe en el pedido remoto. */
export const isDraftLineAlreadyCreated = (
  line: OrderDraftLine,
  existing: ExistingSalesLine[],
  confirmedMatching = 0,
) => existing.filter((x) => sameLine(line, x)).length > confirmedMatching;

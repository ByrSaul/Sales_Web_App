import type { OrderDraft, OrderDraftLine } from './types';
export type DraftError = { code: string; field: string; message: string; lineId?: string };
export const validateDraftLine = (line: OrderDraftLine): DraftError[] => {
  const e: DraftError[] = [],
    add = (code: string, field: string, message: string) =>
      e.push({ code, field, message, lineId: line.localId });
  if (line.quantity <= 0)
    add('quantity_positive', 'quantity', 'La cantidad debe ser mayor que cero.');
  if (line.productType === 'MasterProduct' && !line.presentationCode)
    add('variant_required', 'variant', 'El producto maestro requiere una variante.');
  if (!line.siteId) add('site_required', 'siteId', 'El sitio es obligatorio.');
  if (!line.warehouseId) add('warehouse_required', 'warehouseId', 'El almacén es obligatorio.');
  if (line.price <= 0 && !line.isBonification)
    add('price_positive', 'price', 'El precio debe ser mayor que cero.');
  if (line.source === 'agreement' && line.matchingAgreementLine == null)
    add('agreement_reference', 'agreement', 'La línea de acuerdo no conserva su referencia.');
  if (line.agreementRemainingQuantity != null && line.quantity > line.agreementRemainingQuantity)
    add('agreement_quantity', 'quantity', 'La cantidad excede el saldo restante del acuerdo.');
  return e;
};
export const validateOrderDraft = (d: OrderDraft): DraftError[] => {
  const e: DraftError[] = [],
    add = (code: string, field: string, message: string) => e.push({ code, field, message });
  if (!d.dataAreaId) add('company_required', 'company', 'La empresa es obligatoria.');
  if (!d.vendorId) add('vendor_required', 'vendor', 'El vendedor es obligatorio.');
  if (!d.customer) add('customer_required', 'customer', 'El cliente es obligatorio.');
  if (!d.currencyCode) add('currency_required', 'currency', 'La moneda es obligatoria.');
  if (!d.deliveryMode)
    add('delivery_required', 'deliveryMode', 'El modo de entrega es obligatorio.');
  if (!d.deliveryAddress)
    add('address_required', 'deliveryAddress', 'La dirección de entrega es obligatoria.');
  if (!d.requestedShippingDate)
    add('date_required', 'requestedShippingDate', 'La fecha solicitada es obligatoria.');
  if (!d.lines.length) add('lines_required', 'lines', 'Agregue al menos una línea.');
  return [...e, ...d.lines.flatMap(validateDraftLine)];
};

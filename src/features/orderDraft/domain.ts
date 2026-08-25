import type { Company, OperationalUser, Vendor } from '../../core/session/types';
import type { NewLineSelection, OrderDraft, OrderDraftLine } from './types';

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
/** Construye un borrador nuevo vinculado al contexto operativo actual. */
export const createOrderDraft = (
  accountId: string,
  company: Company,
  vendor: Vendor,
  user: OperationalUser,
): OrderDraft => ({
  id: id(),
  accountId,
  dataAreaId: company.id,
  vendorId: vendor.id,
  languageId: user.language,
  personnelnumber: user.personnelnumber,
  customer: null,
  currencyCode: company.defaultCurrency,
  deliveryMode: null,
  deliveryAddress: null,
  requestedShippingDate: '',
  customerReference: '',
  observations: '',
  salesOrigin: null,
  agreement: null,
  taxExemptNumber: null,
  forceRegisterVariant: false,
  lines: [],
  updatedAt: now(),
});

/** Calcula la cantidad bonificada derivada de cantidad y porcentaje de descuento. */
export const bonusQuantity = (quantity: number, discount: number) => {
  if (quantity <= 0 || discount <= 0) return 0;
  const result = (quantity * discount) / 100;
  return result - Math.floor(result) >= 0.99 ? Math.ceil(result) : Math.floor(result);
};

const baseLine = (
  draft: OrderDraft,
  selection: NewLineSelection,
  localId: string,
): OrderDraftLine => {
  const v = selection.variant;
  const p = selection.price;
  return {
    localId,
    parentLineId: null,
    source: selection.matchingAgreementLine != null ? 'agreement' : 'normal',
    itemId: selection.product.itemId,
    itemName: selection.product.name,
    productType: selection.product.productType,
    presentationCode: v?.displayProductNumber ?? null,
    presentationName: v?.name ?? null,
    dimensions: {
      configId: v?.configId ?? '',
      colorId: v?.colorId ?? '',
      sizeId: v?.sizeId ?? '',
      styleId: v?.styleId ?? '',
      versionId: v?.versionId ?? '',
    },
    quantity: selection.quantity,
    currency: draft.currencyCode,
    price: p?.price ?? 0,
    priceUnit: p?.priceUnit ?? 0,
    lineDiscount: p?.lineDiscount ?? 0,
    linePercent: p?.linePercent ?? 0,
    markup: p?.markup ?? 0,
    discountPct1: p?.discountPct1 ?? 0,
    discountPct2: p?.discountPct2 ?? 0,
    siteId: selection.siteId,
    warehouseId: selection.warehouseId,
    availablePhysical: selection.availablePhysical,
    isBonification: false,
    promotion: null,
    matchingAgreementLine: selection.matchingAgreementLine ?? null,
    agreementRemainingQuantity: selection.agreementRemainingQuantity ?? null,
  };
};

/** Construye las líneas normales y bonificadas a partir de una selección validada. */
export const buildDraftLines = (
  draft: OrderDraft,
  selection: NewLineSelection,
): OrderDraftLine[] => {
  const originalId = id();
  const original = baseLine(draft, selection, originalId);
  if (selection.independentBonification) return [{ ...original, price: 0, isBonification: true }];
  if (!selection.promotion) return [original];
  const relation = id();
  const linkedOriginal = { ...original, parentLineId: relation };
  const bonus: OrderDraftLine = {
    ...original,
    localId: id(),
    parentLineId: relation,
    quantity: bonusQuantity(selection.quantity, selection.promotion.forecastDiscount),
    price: 0,
    priceUnit: 0,
    isBonification: true,
    promotion: {
      groupId: selection.promotion.groupId,
      name: selection.promotion.name,
      forecastDiscount: selection.promotion.forecastDiscount,
    },
    matchingAgreementLine: null,
    agreementRemainingQuantity: null,
    source: 'normal',
  };
  return [linkedOriginal, bonus];
};

/** Elimina una línea local y su línea bonificada vinculada cuando existe. */
export const removeDraftLine = (lines: OrderDraftLine[], localId: string) => {
  const target = lines.find((line) => line.localId === localId);
  if (!target) return lines;
  if (target.isBonification || !target.parentLineId)
    return lines.filter((line) => line.localId !== localId);
  return lines.filter(
    (line) =>
      line.localId !== localId &&
      !(line.isBonification && line.parentLineId === target.parentLineId),
  );
};
export const draftTotal = (draft: OrderDraft) =>
  draft.lines.reduce((sum, line) => sum + line.quantity * line.price, 0);
export const touch = (draft: OrderDraft): OrderDraft => ({ ...draft, updatedAt: now() });

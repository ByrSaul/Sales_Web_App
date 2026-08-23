import type { Agreement, Customer, CustomerAddress, DeliveryMode, Price, Product, ProductVariant, PromotionGroup, SalesOrigin } from '../catalogs/types';

export type DraftDimensions = { configId: string; colorId: string; sizeId: string; styleId: string; versionId: string };
export type DraftAgreement = Pick<Agreement, 'recId' | 'number' | 'title' | 'currency'>;

export type OrderDraftLine = {
  localId: string;
  parentLineId: string | null;
  source: 'normal' | 'agreement';
  itemId: string;
  itemName: string;
  productType: string;
  presentationCode: string | null;
  presentationName: string | null;
  dimensions: DraftDimensions;
  quantity: number;
  currency: string;
  price: number;
  priceUnit: number;
  lineDiscount: number;
  linePercent: number;
  markup: number;
  discountPct1: number;
  discountPct2: number;
  siteId: string;
  warehouseId: string;
  availablePhysical: number;
  isBonification: boolean;
  promotion: Pick<PromotionGroup, 'groupId' | 'name' | 'forecastDiscount'> | null;
  matchingAgreementLine: number | null;
  agreementRemainingQuantity: number | null;
};

export type OrderDraft = {
  id: string;
  accountId: string;
  dataAreaId: string;
  vendorId: string;
  languageId: string;
  orderResponsiblePersonnelNumber: string;
  customer: Customer | null;
  currencyCode: string;
  deliveryMode: DeliveryMode | null;
  deliveryAddress: CustomerAddress | null;
  requestedShippingDate: string;
  customerReference: string;
  observations: string;
  salesOrigin: SalesOrigin | null;
  agreement: DraftAgreement | null;
  taxExemptNumber: string | null;
  lines: OrderDraftLine[];
  updatedAt: string;
};

export type NewLineSelection = {
  product: Product;
  variant: ProductVariant | null;
  quantity: number;
  siteId: string;
  warehouseId: string;
  availablePhysical: number;
  price: Price | null;
  independentBonification: boolean;
  promotion: PromotionGroup | null;
  matchingAgreementLine?: number | null;
  agreementRemainingQuantity?: number | null;
};

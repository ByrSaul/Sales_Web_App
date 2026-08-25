import { buildDraftLines, createOrderDraft } from '../orderDraft/domain';
import type { OrderDraft } from '../orderDraft/types';
import type { Customer, Price, Product } from '../catalogs/types';
export const validDraft = (count = 1): OrderDraft => {
  const customer: Customer = {
    account: 'C1',
    name: 'Cliente',
    warehouseId: 'W1',
    companyId: 'CO',
    currency: 'GTQ',
    salesGroupId: 'V1',
    paymentTerms: '30D',
    blocked: 0,
    blockedDescription: '',
    partyNumber: 'P',
    languageId: 'es',
    countryId: 'GTM',
    creditLimitUsd: 0,
    creditAvailableUsd: 0,
    isCashAccount: false,
  };
  const product: Product = {
    itemId: 'I1',
    name: 'Producto',
    productType: 'Item',
    dimensionGroup: '',
    requiresVariant: false,
  };
  const price: Price = {
    success: true,
    errorMessage: '',
    debugMessage: '',
    currency: 'GTQ',
    exchangeRate: 1,
    price: 25,
    lineDiscount: 0,
    linePercent: 0,
    priceUnit: 1,
    markup: 0,
    discountPct1: 0,
    discountPct2: 0,
  };
  const draft = {
    ...createOrderDraft(
      'A1',
      { id: 'CO', name: 'Company', defaultCurrency: 'GTQ', availableCurrencies: ['GTQ'] },
      { id: 'V1', name: 'Vendor', companyId: 'CO' },
      { id: 'U1', name: 'User', networkAlias: '', language: 'es', personnelnumber: 'P1' },
    ),
    customer,
    deliveryMode: { code: 'D', description: 'Delivery' },
    deliveryAddress: {
      locationId: 'L',
      description: 'Address',
      formattedAddress: 'Street',
      roles: '',
      countryId: 'GTM',
      recId: 1,
    },
    requestedShippingDate: '2026-08-22',
    salesOrigin: { id: 'WEB', description: 'Web' },
  };
  draft.lines = Array.from(
    { length: count },
    (_, index) =>
      buildDraftLines(draft, {
        product: { ...product, itemId: `I${index + 1}` },
        variant: null,
        quantity: index + 1,
        siteId: 'S',
        warehouseId: 'W',
        availablePhysical: 20,
        price,
        independentBonification: false,
        promotion: null,
      })[0],
  );
  return draft;
};

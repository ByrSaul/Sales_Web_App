import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bonusQuantity,
  buildDraftLines,
  createOrderDraft,
  draftTotal,
  removeDraftLine,
} from './domain';
import { validateDraftLine, validateOrderDraft } from './validation';
import type { Customer, Price, Product, PromotionGroup } from '../catalogs/types';
beforeEach(() => vi.stubGlobal('crypto', { randomUUID: vi.fn(() => `id-${Math.random()}`) }));
const customer: Customer = {
  account: 'C1',
  name: 'Cliente',
  companyId: 'CO',
  currency: 'GTQ',
  salesGroupId: 'V1',
  paymentTerms: '30D',
  blocked: false,
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
  lineDiscount: 1,
  linePercent: 2,
  priceUnit: 10,
  markup: 0,
  discountPct1: 0,
  discountPct2: 0,
};
const promotion: PromotionGroup = {
  companyId: 'CO',
  groupId: 'BON',
  name: 'Bonus',
  recId: 1,
  forecastDiscount: 8.33,
};
const draft = () => ({
  ...createOrderDraft(
    'A1',
    { id: 'CO', name: 'Company', defaultCurrency: 'GTQ', availableCurrencies: ['GTQ'] },
    { id: 'V1', name: 'Vendor', companyId: 'CO' },
    { id: 'U1', name: 'User', language: 'es', personnelNumber: 'P1' },
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
});
const selection = () => ({
  product,
  variant: null,
  quantity: 12,
  siteId: 'S',
  warehouseId: 'W',
  availablePhysical: 20,
  price,
  independentBonification: false,
  promotion: null,
});
describe('order draft domain', () => {
  it('creates an account/company-bound local draft', () => {
    const d = draft();
    expect(d.id).toMatch('id-');
    expect(d.accountId).toBe('A1');
    expect(d.dataAreaId).toBe('CO');
  });
  it('preserves PriceUnit and discounts', () => {
    const [line] = buildDraftLines(draft(), selection());
    expect(line.priceUnit).toBe(10);
    expect(line.lineDiscount).toBe(1);
  });
  it('requires positive quantity, site, warehouse and price', () => {
    const [line] = buildDraftLines(draft(), {
      ...selection(),
      quantity: 0,
      siteId: '',
      warehouseId: '',
      price: { ...price, price: 0 },
    });
    expect(validateDraftLine(line).map((e) => e.code)).toEqual(
      expect.arrayContaining([
        'quantity_positive',
        'site_required',
        'warehouse_required',
        'price_positive',
      ]),
    );
  });
  it('requires a variant for MasterProduct', () => {
    const [line] = buildDraftLines(draft(), {
      ...selection(),
      product: { ...product, productType: 'MasterProduct', requiresVariant: true },
    });
    expect(validateDraftLine(line).some((e) => e.code === 'variant_required')).toBe(true);
  });
  it('creates linked original and bonus lines', () => {
    const [a, b] = buildDraftLines(draft(), { ...selection(), promotion });
    expect(b.parentLineId).toBe(a.parentLineId);
    expect(b.isBonification).toBe(true);
    expect(b.quantity).toBe(1);
  });
  it('uses Mobile bonus rounding', () => {
    expect(bonusQuantity(60, 8)).toBe(4);
    expect(bonusQuantity(100, 3.99)).toBe(4);
  });
  it('forces independent bonuses to zero', () => {
    const [line] = buildDraftLines(draft(), { ...selection(), independentBonification: true });
    expect(line.price).toBe(0);
    expect(line.parentLineId).toBeNull();
    expect(validateDraftLine(line)).toEqual([]);
  });
  it('cascades original deletion', () => {
    const lines = buildDraftLines(draft(), { ...selection(), promotion });
    expect(removeDraftLine(lines, lines[0].localId)).toEqual([]);
  });
  it('allows independent bonus deletion', () => {
    const lines = buildDraftLines(draft(), { ...selection(), promotion });
    expect(removeDraftLine(lines, lines[1].localId)).toEqual([lines[0]]);
  });
  it('enforces agreement remaining quantity', () => {
    const [line] = buildDraftLines(draft(), {
      ...selection(),
      matchingAgreementLine: 9,
      agreementRemainingQuantity: 5,
    });
    expect(line.source).toBe('agreement');
    expect(validateDraftLine(line).some((e) => e.code === 'agreement_quantity')).toBe(true);
  });
  it('calculates quantity times price', () => {
    const d = draft();
    d.lines = buildDraftLines(d, selection());
    expect(draftTotal(d)).toBe(300);
  });
  it('validates complete draft', () => {
    const d = draft();
    expect(validateOrderDraft(d).map((e) => e.code)).toContain('lines_required');
    d.lines = buildDraftLines(d, selection());
    expect(validateOrderDraft(d)).toEqual([]);
  });
});

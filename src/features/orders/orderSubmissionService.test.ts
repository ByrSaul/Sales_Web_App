import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../core/api/apiClient';
import { orderSubmissionService } from './orderSubmissionService';
import type { AgreementLineRequest, SalesHeaderRequest, SalesLineRequest } from './types';
const header: SalesHeaderRequest = {
  dataAreaId: 'CO',
  CurrencyCode: 'GTQ',
  LanguageId: 'es',
  InvoiceCustomerAccountNumber: 'C',
  OrderingCustomerAccountNumber: 'C',
  OrderResponsiblePersonnelNumber: 'P',
  DeliveryAddressLocationId: 'L',
};
const line: SalesLineRequest = {
  dataAreaId: 'CO',
  SalesOrderNumber: 'OV',
  ItemNumber: 'I',
  ProductConfigurationId: '',
  ProductStyleId: '',
  ProductSizeId: '',
  ProductColorId: '',
  ProductVersionId: '',
  SalesPrice: 1,
  OrderedSalesQuantity: 1,
  ShippingSiteId: 'S',
  ShippingWarehouseId: 'W',
  FABonification: '0',
};
const fake = () => ({ post: vi.fn(), get: vi.fn() });
describe('orderSubmissionService contracts', () => {
  it('creates header through the authorized endpoint with Mobile timeout', async () => {
    const api = fake();
    api.post.mockResolvedValue([{ SalesOrderNumber: 'OV-1' }]);
    const result = await orderSubmissionService(api as unknown as ApiClient).createHeader(header, 'key-h');
    expect(api.post).toHaveBeenCalledWith('/d365/sales', header, {
      timeoutMs: 60_000,
      headers: { 'Idempotency-Key': 'key-h' },
    });
    expect(result.salesOrderNumber).toBe('OV-1');
  });
  it('routes normal and agreement lines to different endpoints', async () => {
    const api = fake();
    api.post.mockResolvedValue([]);
    const service = orderSubmissionService(api as unknown as ApiClient);
    await service.createNormalLine(line, 'key-1');
    await service.createAgreementLine({
      ...line,
      ChangeShippingWarehouseId: '',
      MatchingAgreementLine: 1,
    } as AgreementLineRequest, 'key-2');
    expect(api.post).toHaveBeenNthCalledWith(1, '/d365/sales/line', line, {
      timeoutMs: 60_000,
      headers: { 'Idempotency-Key': 'key-1' },
    });
    expect(api.post).toHaveBeenNthCalledWith(2, '/d365/sales/line/agreement', expect.any(Object), {
      timeoutMs: 60_000,
      headers: { 'Idempotency-Key': 'key-2' },
    });
  });
  it('verifies existing lines through the browser-compatible POST query without paging limits', async () => {
    const api = fake();
    api.post.mockResolvedValue([]);
    await orderSubmissionService(api as unknown as ApiClient).getExistingLines('CO', 'OV');
    expect(api.get).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith('/d365/sales/line/query', {
      filters: { dataAreaId: ['CO'], SalesOrderNumber: ['OV'] },
      cross_company: true,
      page: 1,
      perpage: 1000,
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../core/api/apiClient';
import { orderSubmissionService } from './orderSubmissionService';
import type { AgreementLineRequest, SalesHeaderRequest, SalesLineRequest } from './types';
const header: SalesHeaderRequest = { dataAreaId: 'CO', CurrencyCode: 'GTQ', LanguageId: 'es', InvoiceCustomerAccountNumber: 'C', OrderingCustomerAccountNumber: 'C', OrderResponsiblePersonnelNumber: 'P', DeliveryAddressLocationId: 'L' };
const line: SalesLineRequest = { dataAreaId: 'CO', SalesOrderNumber: 'OV', ItemNumber: 'I', ProductConfigurationId: '', ProductStyleId: '', ProductSizeId: '', ProductColorId: '', ProductVersionId: '', SalesPrice: 1, OrderedSalesQuantity: 1, ShippingSiteId: 'S', ShippingWarehouseId: 'W', FABonification: '0' };
const fake = () => ({ post: vi.fn(), get: vi.fn() });
describe('orderSubmissionService contracts', () => {
  it('creates header through the authorized endpoint with Mobile timeout', async () => { const api = fake(); api.post.mockResolvedValue([{ SalesOrderNumber: 'OV-1' }]); const result = await orderSubmissionService(api as unknown as ApiClient).createHeader(header); expect(api.post).toHaveBeenCalledWith('/d365/sales', header, { timeoutMs: 60_000 }); expect(result.salesOrderNumber).toBe('OV-1'); });
  it('routes normal and agreement lines to different endpoints', async () => { const api = fake(); api.post.mockResolvedValue([]); const service = orderSubmissionService(api as unknown as ApiClient); await service.createNormalLine(line); await service.createAgreementLine({ ...line, ChangeShippingWarehouseId: '', MatchingAgreementLine: 1 } as AgreementLineRequest); expect(api.post).toHaveBeenNthCalledWith(1, '/d365/sales/line', line, { timeoutMs: 60_000 }); expect(api.post).toHaveBeenNthCalledWith(2, '/d365/sales/line/agreement', expect.any(Object), { timeoutMs: 60_000 }); });
  it('uses the exact Mobile GET-body recovery contract', async () => { const api = fake(); api.get.mockResolvedValue([]); await orderSubmissionService(api as unknown as ApiClient).getExistingLines('CO', 'OV'); expect(api.get).toHaveBeenCalledWith('/d365/sales/line', { body: { filters: { dataAreaId: ['CO'], SalesOrderNumber: ['OV'] } } }); });
});

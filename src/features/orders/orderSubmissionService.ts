import type { ApiClient } from '../../core/api/apiClient';
import { mapExistingLines, mapHeaderResponse } from './orderSubmissionMapper';
import type { AgreementLineRequest, ExistingSalesLine, OrderSubmissionGateway, SalesHeaderRequest, SalesLineRequest } from './types';
export const orderSubmissionService = (api: ApiClient): OrderSubmissionGateway => ({
  async createHeader(request: SalesHeaderRequest) { const result = mapHeaderResponse(await api.post<unknown>('/d365/sales', request, { timeoutMs: 60_000 })); if (!result.salesOrderNumber) throw new Error('Respuesta de encabezado sin SalesOrderNumber'); return result; },
  async createNormalLine(request: SalesLineRequest) { return mapExistingLines(await api.post<unknown>('/d365/sales/line', request, { timeoutMs: 60_000 })); },
  async createAgreementLine(request: AgreementLineRequest) { return mapExistingLines(await api.post<unknown>('/d365/sales/line/agreement', request, { timeoutMs: 60_000 })); },
  async getExistingLines(companyId: string, salesOrderNumber: string): Promise<ExistingSalesLine[]> { return mapExistingLines(await api.get<unknown>('/d365/sales/line', { body: { filters: { dataAreaId: [companyId], SalesOrderNumber: [salesOrderNumber] } } })); },
});

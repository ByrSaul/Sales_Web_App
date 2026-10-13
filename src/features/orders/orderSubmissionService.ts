import type { ApiClient } from '../../core/api/apiClient';
import { mapExistingLines, mapHeaderResponse } from './orderSubmissionMapper';
import type {
  AgreementLineRequest,
  ExistingSalesLine,
  OrderSubmissionGateway,
  SalesHeaderRequest,
  SalesLineRequest,
} from './types';
import { attachmentService } from '../attachments/attachmentService';
import { idempotencyHeaders } from './idempotency';
/**
 * Servicio de persistencia del encabezado, líneas y adjuntos de un pedido.
 *
 * Endpoints utilizados:
 * - `POST /d365/sales`
 * - `POST /d365/sales/line`
 * - `POST /d365/sales/line/agreement`
 * - `POST /d365/sales/line/query`
 *
 * Las tres creaciones envían la clave recibida en el header `Idempotency-Key`, obligatorio en
 * el Backend. La clave pertenece a la operación del llamador; este servicio nunca la genera.
 *
 * @param api Cliente HTTP autenticado.
 * @returns Gateway utilizado por el ejecutor de envío de pedidos.
 */
export const orderSubmissionService = (api: ApiClient): OrderSubmissionGateway => ({
  async createHeader(request: SalesHeaderRequest, idempotencyKey: string) {
    const result = mapHeaderResponse(
      await api.post<unknown>('/d365/sales', request, {
        timeoutMs: 60_000,
        headers: idempotencyHeaders(idempotencyKey),
      }),
    );
    if (!result.salesOrderNumber) throw new Error('Respuesta de encabezado sin SalesOrderNumber');
    return result;
  },
  async createNormalLine(request: SalesLineRequest, idempotencyKey: string) {
    return mapExistingLines(
      await api.post<unknown>('/d365/sales/line', request, {
        timeoutMs: 60_000,
        headers: idempotencyHeaders(idempotencyKey),
      }),
    );
  },
  async createAgreementLine(request: AgreementLineRequest, idempotencyKey: string) {
    return mapExistingLines(
      await api.post<unknown>('/d365/sales/line/agreement', request, {
        timeoutMs: 60_000,
        headers: idempotencyHeaders(idempotencyKey),
      }),
    );
  },
  async getExistingLines(
    companyId: string,
    salesOrderNumber: string,
  ): Promise<ExistingSalesLine[]> {
    return mapExistingLines(
      await api.post<unknown>('/d365/sales/line/query', {
        filters: { dataAreaId: [companyId], SalesOrderNumber: [salesOrderNumber] },
        cross_company: true,
        page: 1,
        perpage: 25,
      }),
    );
  },
  async uploadAttachment(companyId, salesOrderNumber, file, description) {
    await attachmentService(api).upload(companyId, salesOrderNumber, file, description);
  },
  async listAttachments(companyId, salesOrderNumber) {
    return attachmentService(api).list(companyId, salesOrderNumber);
  },
});

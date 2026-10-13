import type { ApiClient } from '../../core/api/apiClient';
import { ApiError } from '../../core/api/errors';
import { mapExistingLines, mapHeaderResponse } from './orderSubmissionMapper';
import type {
  AgreementLineRequest,
  ExistingSalesLine,
  IdempotencyStatusView,
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
 * - `GET /d365/idempotency/{key}?dataAreaId=` (solo lectura, para autorizar una nueva solicitud)
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
        // Igual que la consulta del detalle: la verificación de duplicados debe ver todas las líneas.
        perpage: 1000,
      }),
    );
  },
  async uploadAttachment(companyId, salesOrderNumber, file, description) {
    await attachmentService(api).upload(companyId, salesOrderNumber, file, description);
  },
  async listAttachments(companyId, salesOrderNumber) {
    return attachmentService(api).list(companyId, salesOrderNumber);
  },
  /**
   * Consulta complementaria de solo lectura (`GET /d365/idempotency/{key}?dataAreaId=`), usada
   * únicamente para decidir si una nueva solicitud es segura. Devuelve `null` solo cuando el
   * Backend confirma que la clave nunca se registró; cualquier otra respuesta incompleta falla.
   */
  async getIdempotencyStatus(companyId, idempotencyKey) {
    try {
      return mapIdempotencyStatus(
        await api.get<unknown>(
          `/d365/idempotency/${encodeURIComponent(idempotencyKey)}?dataAreaId=${encodeURIComponent(companyId)}`,
        ),
      );
    } catch (error) {
      if (isUnregisteredKey(error)) return null;
      throw error;
    }
  },
});

const STATUSES = new Set(['Processing', 'Completed', 'Failed']);
const EFFECTS = new Set(['CREATED', 'NONE', 'UNKNOWN']);
const optionalText = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);

/** Valida la respuesta de `IdempotencyService.describe`; nunca supone campos ausentes. */
export const mapIdempotencyStatus = (raw: unknown): IdempotencyStatusView => {
  const j = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (
    typeof j.status !== 'string' ||
    !STATUSES.has(j.status) ||
    typeof j.dynamicsEffect !== 'string' ||
    !EFFECTS.has(j.dynamicsEffect) ||
    typeof j.newRequestAllowed !== 'boolean'
  )
    throw new Error('Respuesta de idempotencia incompleta.');
  return {
    status: j.status as IdempotencyStatusView['status'],
    dynamicsEffect: j.dynamicsEffect as IdempotencyStatusView['dynamicsEffect'],
    newRequestAllowed: j.newRequestAllowed,
    salesOrderNumber: optionalText(j.salesOrderNumber),
    lineReference: optionalText(j.lineReference),
  };
};

// 404 del propio endpoint ("No existe una operación registrada con esa Idempotency-Key…"). Un 404
// genérico (p. ej. un Backend sin el endpoint desplegado) no es evidencia y mantiene el bloqueo.
const isUnregisteredKey = (error: unknown) => {
  if (!(error instanceof ApiError) || error.status !== 404) return false;
  const detail = (error.details as { detail?: unknown } | undefined)?.detail;
  return typeof detail === 'string' && /no existe una operaci[oó]n registrada/i.test(detail);
};

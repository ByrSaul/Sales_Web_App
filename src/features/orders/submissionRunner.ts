import { validateOrderDraft } from '../orderDraft/validation';
import { hasValidLocalPaymentAttachment, hasValidPaymentAttachment, requiresPaymentAttachment, validateAttachment } from '../attachments/attachmentValidation';
import type { OrderDraft, OrderDraftLine } from '../orderDraft/types';
import { isAmbiguousError, mutationErrorMessage } from './mutationOutcome';
import {
  isDraftLineAlreadyCreated,
  mapAgreementLineRequest,
  mapHeaderRequest,
  mapNormalLineRequest,
  sameLine,
} from './orderSubmissionMapper';
import { saveSubmission } from './submissionStorage';
import type { OrderSubmission, OrderSubmissionGateway, SubmissionAttachmentInput, SubmissionResult } from './types';

type Listener = (state: OrderSubmission) => void;
const clone = <T>(value: T): T => structuredClone(value);
const timestamp = () => new Date().toISOString();
const friendly = mutationErrorMessage;
const ambiguousHeader = isAmbiguousError;
const initial = (draft: OrderDraft): OrderSubmission => {
  const time = timestamp();
  return {
    schemaVersion: 1,
    accountId: draft.accountId,
    companyId: draft.dataAreaId,
    draftId: draft.id,
    salesOrderNumber: null,
    status: 'idle',
    headerAmbiguous: false,
    createdAt: time,
    updatedAt: time,
    snapshot: clone(draft),
    lines: draft.lines.map((line) => ({
      localId: line.localId,
      status: 'pending',
      attempts: 0,
      error: null,
      backendLineNumber: null,
      draftLine: clone(line),
    })),
    error: null,
  };
};

export class SubmissionRunner {
  private running = false;
  constructor(
    private readonly gateway: OrderSubmissionGateway,
    private readonly listener: Listener = () => undefined,
  ) {}
  private publish(state: OrderSubmission, persist = Boolean(state.salesOrderNumber)) {
    state.updatedAt = timestamp();
    if (persist) saveSubmission(state);
    this.listener(clone(state));
  }
  async submit(
    draft: OrderDraft,
    recovery?: OrderSubmission | null,
    attachments: SubmissionAttachmentInput[] = [],
  ): Promise<SubmissionResult> {
    if (this.running) throw new Error('Ya existe un envío activo.');
    this.running = true;
    const state = recovery ? clone(recovery) : initial(draft);
    try {
      state.status = 'validating';
      this.publish(state, false);
      const validation = validateOrderDraft(state.snapshot);
      const attachmentValidation = attachments
        .map((item) => validateAttachment(item.file, item.description))
        .filter((message): message is string => Boolean(message));
      if (
        requiresPaymentAttachment(state.snapshot.customer?.account) &&
        !hasValidLocalPaymentAttachment(
          attachments.map((item) => ({
            description: item.description,
            extension: item.file.name.split('.').pop() ?? '',
          })),
        )
      )
        attachmentValidation.push(
          'Debe agregar un comprobante de pago en formato JPG, JPEG o PNG con descripción “pago”.',
        );
      if (attachmentValidation.length) {
        validation.push({
          code: 'attachments_invalid',
          field: 'attachments',
          message: attachmentValidation.join(' '),
        });
      }
      if (validation.length) {
        state.status = 'failed';
        state.error = validation.map((e) => e.message).join(' ');
        this.publish(state, Boolean(state.salesOrderNumber));
        return { submission: state, completed: false };
      }
      if (!state.salesOrderNumber) {
        state.status = 'creating-header';
        this.publish(state, false);
        let request: ReturnType<typeof mapHeaderRequest>;
        try {
          request = mapHeaderRequest(state.snapshot);
        } catch (error) {
          // El request todavía no existe: Dynamics no recibió ningún POST y el resultado es seguro.
          state.status = 'failed';
          state.headerAmbiguous = false;
          state.error = friendly(error);
          this.publish(state, false);
          return { submission: state, completed: false };
        }
        try {
          const header = await this.gateway.createHeader(request);
          state.salesOrderNumber = header.salesOrderNumber;
          state.status = 'header-created';
          this.publish(state, true);
        } catch (error) {
          state.status = 'failed';
          state.headerAmbiguous = ambiguousHeader(error);
          state.error = friendly(error);
          this.publish(state, state.headerAmbiguous);
          return { submission: state, completed: false };
        }
      }
      state.attachmentNames = attachments.map((item) => item.file.name);
      state.createdAttachmentIds ??= [];
      for (const attachment of attachments) {
        if (state.createdAttachmentIds.includes(attachment.localId)) continue;
        state.status = 'uploading-attachments';
        state.attachmentError = null;
        state.attachmentRetryAllowed = false;
        this.publish(state, true);
        try {
          if (!this.gateway.uploadAttachment)
            throw new Error('El gateway no permite subir adjuntos.');
          await this.gateway.uploadAttachment(
            state.companyId,
            state.salesOrderNumber!,
            attachment.file,
            attachment.description,
          );
          state.createdAttachmentIds.push(attachment.localId);
          this.publish(state, true);
        } catch (error) {
          const extension = attachment.file.name.split('.').pop()?.toLowerCase() ?? '';
          const baseName = attachment.file.name.slice(0, -(extension.length + 1));
          let confirmed = false;
          try {
            if (!this.gateway.listAttachments)
              throw new Error('El gateway no permite verificar adjuntos.');
            const existing = await this.gateway.listAttachments(
              state.companyId,
              state.salesOrderNumber!,
            );
            confirmed = existing.some(
              (item) =>
                [item.fileName, `${item.fileName}.${item.fileType}`].some(
                  (name) =>
                    name.toLowerCase() === attachment.file.name.toLowerCase() ||
                    name.toLowerCase() === baseName.toLowerCase(),
                ) && item.description.trim() === attachment.description.trim(),
            );
          } catch {
            // La verificación fallida conserva el resultado ambiguo y evita crear líneas.
          }
          if (confirmed) {
            state.createdAttachmentIds.push(attachment.localId);
            this.publish(state, true);
            continue;
          }
          state.status = 'partial-failure';
          state.attachmentRetryAllowed = !isAmbiguousError(error);
          state.attachmentError = `${friendly(error)} No fue posible confirmar el adjunto; no se crearon líneas ni se reenvió el archivo.`;
          state.error = state.attachmentError;
          this.publish(state, true);
          return { submission: state, completed: false };
        }
      }
      if (requiresPaymentAttachment(state.snapshot.customer?.account)) {
        try {
          if (!this.gateway.listAttachments)
            throw new Error('El gateway no permite verificar adjuntos.');
          const persisted = await this.gateway.listAttachments(
            state.companyId,
            state.salesOrderNumber!,
          );
          if (!hasValidPaymentAttachment(persisted))
            throw new Error('Dynamics todavía no devuelve un comprobante de pago válido.');
        } catch (error) {
          state.status = 'partial-failure';
          state.attachmentRetryAllowed = false;
          state.attachmentError = `${friendly(error)} El pedido fue creado, pero las líneas no serán enviadas hasta confirmar el comprobante de pago.`;
          state.error = state.attachmentError;
          this.publish(state, true);
          return { submission: state, completed: false };
        }
      }
      state.status = 'creating-lines';
      state.error = null;
      this.publish(state, true);
      for (const operational of state.lines) {
        if (operational.status === 'created') continue;
        if (recovery?.salesOrderNumber && operational.attempts > 0) {
          state.status = 'recovering';
          this.publish(state, true);
          const beforeRetry = await this.verify(state, operational.draftLine);
          if (beforeRetry === 'exists') {
            operational.status = 'created';
            operational.error = null;
            this.publish(state, true);
            continue;
          }
          if (beforeRetry === 'unknown') {
            operational.status = 'failed';
            operational.error =
              'No fue posible verificar Dynamics; no se reintentó para evitar duplicados.';
            this.publish(state, true);
            continue;
          }
        }
        operational.status = 'creating';
        operational.error = null;
        this.publish(state, true);
        const create = () => {
          operational.attempts += 1;
          const line = operational.draftLine;
          return line.source === 'agreement'
            ? this.gateway.createAgreementLine(
                mapAgreementLineRequest(state.snapshot, line, state.salesOrderNumber!),
              )
            : this.gateway.createNormalLine(
                mapNormalLineRequest(state.snapshot, line, state.salesOrderNumber!),
              );
        };
        try {
          const response = await create();
          operational.status = 'created';
          operational.backendLineNumber = response[0]?.lineNumber ?? null;
          this.publish(state, true);
          continue;
        } catch (firstError) {
          operational.status = 'failed';
          operational.error = friendly(firstError);
          state.status = 'recovering';
          this.publish(state, true);
          const verified = await this.verify(state, operational.draftLine);
          if (verified === 'exists') {
            operational.status = 'created';
            operational.error = null;
            this.publish(state, true);
            continue;
          }
          if (verified === 'unknown') {
            operational.error = `${operational.error} No fue posible verificar la línea; no se reintentó para evitar duplicados.`;
            this.publish(state, true);
            continue;
          }
          if (operational.attempts >= 2) {
            operational.error = `${operational.error} Se alcanzó el máximo de dos intentos.`;
            this.publish(state, true);
            continue;
          }
          try {
            operational.status = 'creating';
            this.publish(state, true);
            const response = await create();
            operational.status = 'created';
            operational.error = null;
            operational.backendLineNumber = response[0]?.lineNumber ?? null;
            this.publish(state, true);
          } catch (retryError) {
            operational.status = 'failed';
            operational.error = friendly(retryError);
            const afterRetry = await this.verify(state, operational.draftLine);
            if (afterRetry === 'exists') {
              operational.status = 'created';
              operational.error = null;
            } else if (afterRetry === 'unknown')
              operational.error += ' No se pudo verificar el resultado del último intento.';
            this.publish(state, true);
          }
        }
      }
      const failed = state.lines.filter((line) => line.status !== 'created');
      state.status = failed.length ? 'partial-failure' : 'completed';
      state.error = failed.length ? `${failed.length} línea(s) continúan pendientes.` : null;
      this.publish(state, true);
      return { submission: state, completed: !failed.length };
    } finally {
      this.running = false;
    }
  }
  private async verify(
    state: OrderSubmission,
    line: OrderDraftLine,
  ): Promise<'exists' | 'missing' | 'unknown'> {
    try {
      const existing = await this.gateway.getExistingLines(
        state.companyId,
        state.salesOrderNumber!,
      );
      const confirmedSimilar = state.lines.filter(
        (x) =>
          x.status === 'created' &&
          x.localId !== line.localId &&
          sameLine(line, {
            lineNumber: 0,
            itemNumber: x.draftLine.itemId,
            productConfigurationId: x.draftLine.dimensions.configId,
            productStyleId: x.draftLine.dimensions.styleId,
            productSizeId: x.draftLine.dimensions.sizeId,
            productColorId: x.draftLine.dimensions.colorId,
            productVersionId: x.draftLine.dimensions.versionId,
            salesPrice: x.draftLine.price,
            orderedSalesQuantity: x.draftLine.quantity,
            shippingSiteId: x.draftLine.siteId,
            shippingWarehouseId: x.draftLine.warehouseId,
            csfaSuppItemGroupId: x.draftLine.promotion?.groupId ?? '',
            faBonification: x.draftLine.isBonification ? 'Yes' : 'No',
          }),
      ).length;
      return isDraftLineAlreadyCreated(line, existing, confirmedSimilar) ? 'exists' : 'missing';
    } catch {
      return 'unknown';
    }
  }
}

import { validateOrderDraft } from '../orderDraft/validation';
import { hasValidLocalPaymentAttachment, hasValidPaymentAttachment, requiresPaymentAttachment, validateAttachment } from '../attachments/attachmentValidation';
import type { OrderDraft } from '../orderDraft/types';
import {
  classifyCreationError,
  creationOutcomeMessage,
  newIdempotencyKey,
  type CreationOutcome,
} from './idempotency';
import { isAmbiguousError, mutationErrorMessage } from './mutationOutcome';
import {
  assessNewRequest,
  hasUnresolvedOperation,
  isRetryableTracking,
  isUnresolvedTracking,
  trackingFromOutcome,
} from './operationTracking';
import {
  isDraftLineAlreadyCreated,
  mapAgreementLineRequest,
  mapHeaderRequest,
  mapNormalLineRequest,
  sameLine,
} from './orderSubmissionMapper';
import { saveSubmission } from './submissionStorage';
import type {
  ExistingSalesLine,
  OrderSubmission,
  OrderSubmissionGateway,
  SubmissionAttachmentInput,
  SubmissionLine,
  SubmissionResult,
} from './types';

type Listener = (state: OrderSubmission) => void;
const clone = <T>(value: T): T => structuredClone(value);
const timestamp = () => new Date().toISOString();
const friendly = mutationErrorMessage;

/** Mensaje de una creación fallida: estado del Backend y, si existe, el detalle de la respuesta. */
const outcomeError = (outcome: CreationOutcome, error: unknown) =>
  outcome.kind === 'rejected'
    ? `${creationOutcomeMessage(outcome)} ${friendly(error)}`
    : creationOutcomeMessage(outcome);

/**
 * Crea el estado inicial de una ejecución nueva.
 *
 * Es el único punto donde se generan las claves de idempotencia del encabezado y de cada línea:
 * una por operación lógica, independientes del número de pedido y del contenido comercial.
 */
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
    headerIdempotencyKey: newIdempotencyKey(),
    headerTracking: 'not-sent',
    createdAt: time,
    updatedAt: time,
    snapshot: clone(draft),
    lines: draft.lines.map((line) => ({
      localId: line.localId,
      idempotencyKey: newIdempotencyKey(),
      tracking: 'not-sent',
      status: 'pending',
      attempts: 0,
      error: null,
      backendLineNumber: null,
      draftLine: clone(line),
    })),
    error: null,
  };
};

/** Estado global derivado del seguimiento de las líneas cuando el encabezado ya existe. */
const linesStatus = (state: OrderSubmission) => {
  const pending = state.lines.filter((line) => line.tracking !== 'completed');
  if (!pending.length) return { status: 'completed' as const, error: null };
  if (state.lines.some((line) => isUnresolvedTracking(line.tracking)))
    return {
      status: 'awaiting-confirmation' as const,
      error: `${pending.length} línea(s) continúan pendientes. Hay una línea sin resultado confirmado: consulte su estado antes de continuar.`,
    };
  return {
    status: 'partial-failure' as const,
    error: `${pending.length} línea(s) continúan pendientes.`,
  };
};

/**
 * Indica si, tras consultar el estado, puede continuarse con las operaciones pendientes: el
 * encabezado existe, nada queda sin confirmar y ninguna operación fallida espera la decisión
 * del usuario de iniciar una nueva solicitud.
 */
const canResumeAfterVerification = (state: OrderSubmission) =>
  Boolean(state.salesOrderNumber) &&
  state.status !== 'completed' &&
  !state.attachmentError &&
  !hasUnresolvedOperation(state) &&
  !state.lines.some((line) => isRetryableTracking(line.tracking));

/**
 * Orquestador reanudable para crear encabezado, adjuntos y líneas de un pedido.
 *
 * Reglas de idempotencia:
 * - Cada creación se envía una sola vez por ejecución, con su `Idempotency-Key` persistida antes del POST.
 * - No existen reintentos automáticos de POST. Un timeout, un error de red, un 5xx o un 409
 *   dejan la operación pendiente de confirmación, conservan su clave y detienen la secuencia.
 * - Solo `verifyPending` consulta el estado, a petición del usuario y con la misma clave.
 * - Una nueva solicitud (otra clave) solo se habilita cuando el Backend confirma que el intento
 *   anterior no produjo efectos en Dynamics (`assessHeaderRetry`, `prepareRetry`).
 */
export class SubmissionRunner {
  private running = false;
  /**
   * @param gateway Operaciones de infraestructura necesarias para persistir el pedido.
   * @param listener Suscriptor notificado después de cada transición observable.
   */
  constructor(
    private readonly gateway: OrderSubmissionGateway,
    private readonly listener: Listener = () => undefined,
  ) {}
  /** Actualiza la marca temporal, persiste opcionalmente y publica una copia del estado. */
  private publish(state: OrderSubmission, persist = Boolean(state.salesOrderNumber)) {
    state.updatedAt = timestamp();
    if (persist) saveSubmission(state);
    this.listener(clone(state));
  }
  private async exclusive<T>(work: () => Promise<T>): Promise<T> {
    if (this.running) throw new Error('Ya existe un envío activo.');
    this.running = true;
    try {
      return await work();
    } finally {
      this.running = false;
    }
  }
  /**
   * Ejecuta o reanuda el envío completo de un borrador.
   *
   * Una recuperación con el encabezado o alguna línea sin resultado confirmado no envía nada:
   * primero debe resolverse con `verifyPending`.
   *
   * @param draft Borrador que actúa como snapshot del envío.
   * @param recovery Ejecución previa que debe continuar.
   * @param attachments Adjuntos locales pendientes de cargar.
   * @returns Estado final de la ejecución e indicador de finalización completa.
   */
  submit(
    draft: OrderDraft,
    recovery?: OrderSubmission | null,
    attachments: SubmissionAttachmentInput[] = [],
  ): Promise<SubmissionResult> {
    return this.exclusive(() => this.run(draft, recovery, attachments));
  }

  private async run(
    draft: OrderDraft,
    recovery: OrderSubmission | null | undefined,
    attachments: SubmissionAttachmentInput[],
  ): Promise<SubmissionResult> {
    const state = recovery ? clone(recovery) : initial(draft);
    if (recovery && hasUnresolvedOperation(state)) {
      state.error = creationOutcomeMessage({ kind: 'unknown' });
      this.publish(state, true);
      return { submission: state, completed: false };
    }
    state.status = 'validating';
    this.publish(state, false);
    const validation = validateOrderDraft(state.snapshot);
    const attachmentValidation = attachments
      .map((item) => validateAttachment(item.file, item.description))
      .filter((message): message is string => Boolean(message));
    if (
      requiresPaymentAttachment(state.snapshot.customer?.account) &&
      !state.salesOrderNumber &&
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
      const created = await this.createHeader(state);
      if (!created) return { submission: state, completed: false };
    }
    if (!(await this.uploadAttachments(state, attachments)))
      return { submission: state, completed: false };
    state.status = 'creating-lines';
    state.error = null;
    this.publish(state, true);
    await this.createLines(state);
    const summary = linesStatus(state);
    state.status = summary.status;
    state.error = summary.error;
    this.publish(state, true);
    return { submission: state, completed: summary.status === 'completed' };
  }

  /** Primera ejecución del encabezado con su clave persistida. Devuelve `true` si quedó creado. */
  private async createHeader(state: OrderSubmission): Promise<boolean> {
    if (state.headerTracking !== 'not-sent') {
      // Solo una clave nueva (tras `Failed`/rechazo confirmado) puede enviarse.
      state.status = 'failed';
      state.error = isRetryableTracking(state.headerTracking)
        ? 'El encabezado anterior falló. Use “Reintentar encabezado” para enviarlo como una operación nueva.'
        : creationOutcomeMessage({ kind: 'unknown' });
      this.publish(state, true);
      return false;
    }
    let request: ReturnType<typeof mapHeaderRequest>;
    try {
      request = mapHeaderRequest(state.snapshot);
    } catch (error) {
      // El request todavía no existe: Dynamics no recibió ningún POST y el resultado es seguro.
      state.status = 'failed';
      state.headerAmbiguous = false;
      state.error = friendly(error);
      this.publish(state, false);
      return false;
    }
    if (!state.headerIdempotencyKey) {
      // Recuperación anterior a la Idempotency-Key: reenviar podría duplicar el pedido.
      state.status = 'failed';
      state.headerAmbiguous = true;
      state.headerTracking = 'awaiting-confirmation';
      state.error = 'La recuperación no tiene clave de idempotencia; verifique el pedido en Dynamics.';
      this.publish(state, true);
      return false;
    }
    state.status = 'creating-header';
    // La clave y el seguimiento se persisten antes del POST: si la página se cierra con la
    // solicitud en curso, la recuperación conserva la misma operación y no la reenvía sola.
    state.headerTracking = 'awaiting-confirmation';
    this.publish(state, true);
    try {
      const header = await this.gateway.createHeader(request, state.headerIdempotencyKey);
      this.markHeaderCreated(state, header.salesOrderNumber);
      return true;
    } catch (error) {
      this.applyHeaderFailure(state, error);
      return false;
    }
  }

  private markHeaderCreated(state: OrderSubmission, salesOrderNumber: string) {
    state.salesOrderNumber = salesOrderNumber;
    state.status = 'header-created';
    state.headerAmbiguous = false;
    state.headerTracking = 'completed';
    state.error = null;
    this.publish(state, true);
  }

  private applyHeaderFailure(state: OrderSubmission, error: unknown) {
    const outcome = classifyCreationError(error);
    state.status = 'failed';
    state.headerTracking = trackingFromOutcome(outcome);
    state.headerAmbiguous = isUnresolvedTracking(state.headerTracking);
    state.error = outcomeError(outcome, error);
    // También un 4xx conserva el seguimiento y su clave: un código HTTP no demuestra por sí solo
    // que Dynamics no creó nada. La nueva solicitud pasa por `assessHeaderRetry`.
    this.publish(state, true);
  }

  private async uploadAttachments(
    state: OrderSubmission,
    attachments: SubmissionAttachmentInput[],
  ): Promise<boolean> {
    state.attachmentNames = attachments.map((item) => item.file.name);
    state.createdAttachmentIds ??= [];
    for (const attachment of attachments) {
      if (state.createdAttachmentIds.includes(attachment.localId)) continue;
      if (!(await this.uploadAttachment(state, attachment))) return false;
    }
    return this.verifyPaymentAttachment(state);
  }

  private async uploadAttachment(
    state: OrderSubmission,
    attachment: SubmissionAttachmentInput,
  ): Promise<boolean> {
    state.status = 'uploading-attachments';
    state.attachmentError = null;
    state.attachmentRetryAllowed = false;
    this.publish(state, true);
    try {
      if (!this.gateway.uploadAttachment) throw new Error('El gateway no permite subir adjuntos.');
      await this.gateway.uploadAttachment(
        state.companyId,
        state.salesOrderNumber!,
        attachment.file,
        attachment.description,
      );
      state.createdAttachmentIds!.push(attachment.localId);
      this.publish(state, true);
    } catch (error) {
      const confirmed = await this.attachmentExists(state, attachment);
      if (confirmed) {
        state.createdAttachmentIds!.push(attachment.localId);
        this.publish(state, true);
        return true;
      }
      state.status = 'partial-failure';
      state.attachmentRetryAllowed = !isAmbiguousError(error);
      state.attachmentError = `${friendly(error)} No fue posible confirmar el adjunto; no se crearon líneas ni se reenvió el archivo.`;
      state.error = state.attachmentError;
      this.publish(state, true);
      return false;
    }
    return true;
  }

  private async attachmentExists(
    state: OrderSubmission,
    attachment: SubmissionAttachmentInput,
  ): Promise<boolean> {
    const extension = attachment.file.name.split('.').pop()?.toLowerCase() ?? '';
    const baseName = attachment.file.name.slice(0, -(extension.length + 1));

    try {
      if (!this.gateway.listAttachments)
        throw new Error('El gateway no permite verificar adjuntos.');
      const existing = await this.gateway.listAttachments(state.companyId, state.salesOrderNumber!);
      return existing.some(
        (item) =>
          [item.fileName, `${item.fileName}.${item.fileType}`].some(
            (name) =>
              name.toLowerCase() === attachment.file.name.toLowerCase() ||
              name.toLowerCase() === baseName.toLowerCase(),
          ) && item.description.trim() === attachment.description.trim(),
      );
    } catch {
      // An unavailable lookup cannot confirm persistence; it never triggers another upload.
    }

    return false;
  }

  private async verifyPaymentAttachment(state: OrderSubmission): Promise<boolean> {
    if (!requiresPaymentAttachment(state.snapshot.customer?.account)) {
      state.attachmentError = null;
      return true;
    }
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
      return false;
    }

    state.attachmentError = null;
    return true;
  }

  private createLineRequest(state: OrderSubmission, operational: SubmissionLine) {
    const line = operational.draftLine;
    return line.source === 'agreement'
      ? this.gateway.createAgreementLine(
          mapAgreementLineRequest(state.snapshot, line, state.salesOrderNumber!),
          operational.idempotencyKey,
        )
      : this.gateway.createNormalLine(
          mapNormalLineRequest(state.snapshot, line, state.salesOrderNumber!),
          operational.idempotencyKey,
        );
  }

  private markLineCreated(state: OrderSubmission, operational: SubmissionLine, response: ExistingSalesLine[] | null) {
    operational.status = 'created';
    operational.tracking = 'completed';
    operational.error = null;
    if (response) operational.backendLineNumber = response[0]?.lineNumber ?? operational.backendLineNumber;
    this.publish(state, true);
  }

  private applyLineFailure(state: OrderSubmission, operational: SubmissionLine, error: unknown) {
    const outcome = classifyCreationError(error);
    operational.tracking = trackingFromOutcome(outcome);
    operational.status = isUnresolvedTracking(operational.tracking) ? 'unconfirmed' : 'failed';
    operational.error = outcomeError(outcome, error);
    this.publish(state, true);
  }

  /**
   * Crea las líneas en orden, una sola vez cada una. Se detiene en la primera línea que no quede
   * creada: las líneas posteriores (por ejemplo, una bonificación ligada) dependen de su resultado.
   */
  private async createLines(state: OrderSubmission) {
    for (const operational of state.lines) {
      if (operational.tracking === 'completed') continue;
      if (operational.tracking !== 'not-sent') break;
      operational.status = 'creating';
      operational.tracking = 'awaiting-confirmation';
      operational.error = null;
      operational.attempts += 1;
      this.publish(state, true);
      try {
        this.markLineCreated(state, operational, await this.createLineRequest(state, operational));
      } catch (error) {
        this.applyLineFailure(state, operational, error);
        break;
      }
    }
  }

  /**
   * Consulta, a petición del usuario, el estado de las creaciones sin resultado confirmado.
   *
   * El Backend no expone una consulta de idempotencia: reenviar la misma clave con el mismo body
   * es el único mecanismo que devuelve su estado (`Completed` → respuesta original; `Processing`,
   * `Failed` u otro body → 409) y nunca crea un duplicado. Para las líneas se consulta antes, sin
   * POST, si ya aparecen en el pedido. No continúa con otras operaciones: eso requiere `submit`.
   */
  verifyPending(recovery: OrderSubmission): Promise<SubmissionResult> {
    return this.exclusive(() => this.verify(recovery));
  }

  /**
   * Consulta las operaciones sin resultado confirmado y, si todas quedaron `Completed` y no hay
   * fallos que requieran una nueva solicitud, continúa con las operaciones pendientes (primeras
   * ejecuciones). Nunca genera claves nuevas.
   */
  verifyAndResume(
    recovery: OrderSubmission,
    draft: OrderDraft,
    attachments: SubmissionAttachmentInput[] = [],
  ): Promise<SubmissionResult> {
    return this.exclusive(async () => {
      const verified = await this.verify(recovery);
      return canResumeAfterVerification(verified.submission)
        ? this.run(draft, verified.submission, attachments)
        : verified;
    });
  }

  private async verify(recovery: OrderSubmission): Promise<SubmissionResult> {
    const state = clone(recovery);
    if (!state.salesOrderNumber) {
      if (state.headerIdempotencyKey && isUnresolvedTracking(state.headerTracking)) {
        state.status = 'recovering';
        this.publish(state, true);
        try {
          const header = await this.gateway.createHeader(
            mapHeaderRequest(state.snapshot),
            state.headerIdempotencyKey,
          );
          // Completed: se recupera el número de pedido sin recrear el encabezado.
          this.markHeaderCreated(state, header.salesOrderNumber);
          state.status = 'partial-failure';
          state.error = 'El encabezado está confirmado; quedan operaciones pendientes.';
          this.publish(state, true);
        } catch (error) {
          const outcome = classifyCreationError(error);
          state.status = 'failed';
          state.headerTracking = trackingFromOutcome(outcome);
          state.headerAmbiguous = isUnresolvedTracking(state.headerTracking);
          state.error = outcomeError(outcome, error);
          this.publish(state, true);
        }
      }
      return { submission: state, completed: false };
    }
    for (const operational of state.lines) {
      if (!isUnresolvedTracking(operational.tracking)) continue;
      state.status = 'recovering';
      this.publish(state, true);
      if ((await this.lineExists(state, operational)) === 'exists') {
        this.markLineCreated(state, operational, null);
        continue;
      }
      try {
        this.markLineCreated(state, operational, await this.createLineRequest(state, operational));
      } catch (error) {
        this.applyLineFailure(state, operational, error);
      }
    }
    const summary = linesStatus(state);
    state.status = summary.status;
    state.error = summary.error;
    this.publish(state, true);
    return { submission: state, completed: summary.status === 'completed' };
  }

  /**
   * Decide si un encabezado que terminó con error admite una nueva solicitud con otra clave.
   *
   * - `safe: true`: el Backend confirmó que el intento anterior no produjo efectos.
   * - Efectos confirmados con número de pedido: se recupera la referencia (sin crear otro).
   * - Sin evidencia suficiente: la creación queda bloqueada con la explicación en `error`.
   * Nunca genera claves: la nueva solicitud parte de un envío nuevo creado por el llamador.
   */
  assessHeaderRetry(recovery: OrderSubmission): Promise<{ submission: OrderSubmission; safe: boolean }> {
    return this.exclusive(async () => {
      const state = clone(recovery);
      if (
        state.salesOrderNumber ||
        !state.headerIdempotencyKey ||
        !isRetryableTracking(state.headerTracking)
      )
        return { submission: state, safe: false };
      const evidence = await assessNewRequest(this.gateway, state.companyId, state.headerIdempotencyKey);
      if (evidence.decision === 'safe') return { submission: state, safe: true };
      if (evidence.decision === 'created' && evidence.salesOrderNumber) {
        // El pedido existe en Dynamics (Completed o Failed parcial): se recupera su número.
        this.markHeaderCreated(state, evidence.salesOrderNumber);
        state.status = 'partial-failure';
        state.error = `El Backend confirma que el pedido ${evidence.salesOrderNumber} ya existe; no se creará otro.`;
        this.publish(state, true);
        return { submission: state, safe: false };
      }
      state.error =
        evidence.decision === 'created'
          ? 'El Backend confirma que el encabezado tuvo efectos en Dynamics, pero no informa el número de pedido. La nueva creación permanece bloqueada; requiere revisión manual.'
          : evidence.reason;
      this.publish(state, true);
      return { submission: state, safe: false };
    });
  }

  /**
   * Prepara una nueva solicitud de las líneas que terminaron con error.
   *
   * Solo se usa otra clave cuando el Backend confirma que el intento anterior no produjo efectos
   * (`assessNewRequest`) y la línea tampoco aparece en el pedido. Si el Backend confirma efectos, la
   * línea se marca creada; sin evidencia suficiente se mantiene bloqueada con su clave.
   */
  prepareRetry(recovery: OrderSubmission): Promise<OrderSubmission> {
    return this.exclusive(async () => {
      const state = clone(recovery);
      if (hasUnresolvedOperation(state) || !state.salesOrderNumber) return state;
      for (const operational of state.lines) {
        if (!isRetryableTracking(operational.tracking)) continue;
        const evidence = await assessNewRequest(this.gateway, state.companyId, operational.idempotencyKey);
        if (evidence.decision === 'created') {
          this.markLineCreated(state, operational, null);
          continue;
        }
        if (evidence.decision === 'blocked') {
          operational.error = evidence.reason;
          this.publish(state, true);
          continue;
        }
        const presence = await this.lineExists(state, operational);
        if (presence === 'exists') {
          this.markLineCreated(state, operational, null);
          continue;
        }
        if (presence === 'unknown') {
          operational.error = `${operational.error ?? ''} No fue posible comprobar si la línea existe; no se habilita un nuevo intento.`.trim();
          this.publish(state, true);
          continue;
        }
        operational.idempotencyKey = newIdempotencyKey();
        operational.tracking = 'not-sent';
        operational.status = 'pending';
        operational.error = null;
        this.publish(state, true);
      }
      return state;
    });
  }

  /** Comprueba, sin POST, si una línea local ya está representada entre las líneas remotas. */
  private async lineExists(
    state: OrderSubmission,
    operational: SubmissionLine,
  ): Promise<'exists' | 'missing' | 'unknown'> {
    const line = operational.draftLine;
    try {
      const existing = await this.gateway.getExistingLines(
        state.companyId,
        state.salesOrderNumber!,
      );
      const confirmedSimilar = state.lines.filter(
        (x) =>
          x.tracking === 'completed' &&
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

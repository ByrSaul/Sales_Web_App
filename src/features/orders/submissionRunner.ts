import { validateOrderDraft } from '../orderDraft/validation';
import type { OrderDraft, OrderDraftLine } from '../orderDraft/types';
import { isAmbiguousError, mutationErrorMessage } from './mutationOutcome';
import { isDraftLineAlreadyCreated, mapAgreementLineRequest, mapHeaderRequest, mapNormalLineRequest, sameLine } from './orderSubmissionMapper';
import { saveSubmission } from './submissionStorage';
import type { OrderSubmission, OrderSubmissionGateway, SubmissionResult } from './types';

type Listener = (state: OrderSubmission) => void;
const clone = <T,>(value: T): T => structuredClone(value);
const timestamp = () => new Date().toISOString();
const friendly = mutationErrorMessage;
const ambiguousHeader = isAmbiguousError;
const initial = (draft: OrderDraft): OrderSubmission => { const time = timestamp(); return { schemaVersion: 1, accountId: draft.accountId, companyId: draft.dataAreaId, draftId: draft.id, salesOrderNumber: null, status: 'idle', headerAmbiguous: false, createdAt: time, updatedAt: time, snapshot: clone(draft), lines: draft.lines.map(line => ({ localId: line.localId, status: 'pending', attempts: 0, error: null, backendLineNumber: null, draftLine: clone(line) })), error: null }; };

export class SubmissionRunner {
  private running = false;
  constructor(private readonly gateway: OrderSubmissionGateway, private readonly listener: Listener = () => undefined) {}
  private publish(state: OrderSubmission, persist = Boolean(state.salesOrderNumber)) { state.updatedAt = timestamp(); if (persist) saveSubmission(state); this.listener(clone(state)); }
  async submit(draft: OrderDraft, recovery?: OrderSubmission | null): Promise<SubmissionResult> {
    if (this.running) throw new Error('Ya existe un envío activo.');
    this.running = true;
    const state = recovery ? clone(recovery) : initial(draft);
    try {
      state.status = 'validating'; this.publish(state, false);
      const validation = validateOrderDraft(state.snapshot);
      if (validation.length) { state.status = 'failed'; state.error = validation.map(e => e.message).join(' '); this.publish(state, Boolean(state.salesOrderNumber)); return { submission: state, completed: false }; }
      if (!state.salesOrderNumber) {
        state.status = 'creating-header'; this.publish(state, false);
        try { const header = await this.gateway.createHeader(mapHeaderRequest(state.snapshot)); state.salesOrderNumber = header.salesOrderNumber; state.status = 'header-created'; this.publish(state, true); }
        catch (error) { state.status = 'failed'; state.headerAmbiguous = ambiguousHeader(error); state.error = friendly(error); this.publish(state, state.headerAmbiguous); return { submission: state, completed: false }; }
      }
      state.status = 'creating-lines'; state.error = null; this.publish(state, true);
      for (const operational of state.lines) {
        if (operational.status === 'created') continue;
        if (recovery?.salesOrderNumber && operational.attempts > 0) {
          state.status = 'recovering'; this.publish(state, true);
          const beforeRetry = await this.verify(state, operational.draftLine);
          if (beforeRetry === 'exists') { operational.status = 'created'; operational.error = null; this.publish(state, true); continue; }
          if (beforeRetry === 'unknown') { operational.status = 'failed'; operational.error = 'No fue posible verificar Dynamics; no se reintentó para evitar duplicados.'; this.publish(state, true); continue; }
        }
        operational.status = 'creating'; operational.error = null; this.publish(state, true);
        const create = () => { operational.attempts += 1; const line = operational.draftLine; return line.source === 'agreement' ? this.gateway.createAgreementLine(mapAgreementLineRequest(state.snapshot, line, state.salesOrderNumber!)) : this.gateway.createNormalLine(mapNormalLineRequest(state.snapshot, line, state.salesOrderNumber!)); };
        try { const response = await create(); operational.status = 'created'; operational.backendLineNumber = response[0]?.lineNumber ?? null; this.publish(state, true); continue; }
        catch (firstError) {
          operational.status = 'failed'; operational.error = friendly(firstError); state.status = 'recovering'; this.publish(state, true);
          const verified = await this.verify(state, operational.draftLine);
          if (verified === 'exists') { operational.status = 'created'; operational.error = null; this.publish(state, true); continue; }
          if (verified === 'unknown') { operational.error = `${operational.error} No fue posible verificar la línea; no se reintentó para evitar duplicados.`; this.publish(state, true); continue; }
          if (operational.attempts >= 2) { operational.error = `${operational.error} Se alcanzó el máximo de dos intentos.`; this.publish(state, true); continue; }
          try { operational.status = 'creating'; this.publish(state, true); const response = await create(); operational.status = 'created'; operational.error = null; operational.backendLineNumber = response[0]?.lineNumber ?? null; this.publish(state, true); }
          catch (retryError) { operational.status = 'failed'; operational.error = friendly(retryError); const afterRetry = await this.verify(state, operational.draftLine); if (afterRetry === 'exists') { operational.status = 'created'; operational.error = null; } else if (afterRetry === 'unknown') operational.error += ' No se pudo verificar el resultado del último intento.'; this.publish(state, true); }
        }
      }
      const failed = state.lines.filter(line => line.status !== 'created');
      state.status = failed.length ? 'partial-failure' : 'completed'; state.error = failed.length ? `${failed.length} línea(s) continúan pendientes.` : null; this.publish(state, true);
      return { submission: state, completed: !failed.length };
    } finally { this.running = false; }
  }
  private async verify(state: OrderSubmission, line: OrderDraftLine): Promise<'exists' | 'missing' | 'unknown'> {
    try { const existing = await this.gateway.getExistingLines(state.companyId, state.salesOrderNumber!); const confirmedSimilar = state.lines.filter(x => x.status === 'created' && x.localId !== line.localId && sameLine(line, { lineNumber: 0, itemNumber: x.draftLine.itemId, productConfigurationId: x.draftLine.dimensions.configId, productStyleId: x.draftLine.dimensions.styleId, productSizeId: x.draftLine.dimensions.sizeId, productColorId: x.draftLine.dimensions.colorId, productVersionId: x.draftLine.dimensions.versionId, salesPrice: x.draftLine.price, orderedSalesQuantity: x.draftLine.quantity, shippingSiteId: x.draftLine.siteId, shippingWarehouseId: x.draftLine.warehouseId, csfaSuppItemGroupId: x.draftLine.promotion?.groupId ?? '', faBonification: x.draftLine.isBonification ? 'Yes' : 'No' })).length; return isDraftLineAlreadyCreated(line, existing, confirmedSimilar) ? 'exists' : 'missing'; }
    catch { return 'unknown'; }
  }
}

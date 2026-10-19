import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../core/api/apiClient';
import type { OrderDraft, OrderDraftLine } from '../orderDraft/types';
import { assessNewRequest } from './operationTracking';
import {
  canRetryWithNewKey,
  classifyCreationError,
  creationOutcomeMessage,
  newIdempotencyKey,
} from './idempotency';
import { mutationErrorMessage } from './mutationOutcome';
import { orderKeys } from './orderQueries';
import { mapAgreementLineRequest, mapNormalLineRequest } from './orderSubmissionMapper';
import { orderSubmissionService } from './orderSubmissionService';
import type { OrderSubmissionGateway } from './types';

export type PendingOrderLine = OrderDraftLine & {
  submissionStatus: 'pending' | 'submitting' | 'failed' | 'ambiguous';
  submissionError: string | null;
  idempotencyKey: string;
};
type Mode = 'send' | 'verify';
type LineOutcome = 'created' | 'skip' | 'stop';
type Commit = () => void;

const applyLineFailure = (line: PendingOrderLine, error: unknown, commit: Commit) => {
  const outcome = classifyCreationError(error);
  const retryable = canRetryWithNewKey(outcome);
  line.submissionStatus = retryable ? 'failed' : 'ambiguous';
  line.submissionError = creationOutcomeMessage(outcome);
  if (retryable) line.submissionError += ` ${mutationErrorMessage(error)}`;
  commit();
};

const restorePendingLines = (raw: string | null): PendingOrderLine[] => {
  if (!raw) return [];
  return (JSON.parse(raw) as PendingOrderLine[]).map((line) => {
    const withKey = line.idempotencyKey ? line : { ...line, idempotencyKey: newIdempotencyKey() };
    if (withKey.submissionStatus !== 'submitting') return withKey;
    return {
      ...withKey,
      submissionStatus: 'ambiguous',
      submissionError: creationOutcomeMessage({ kind: 'unknown' }),
    };
  });
};

/** A failed key is never renewed without the same read-only evidence used by the page. */
const prepareLine = async (
  line: PendingOrderLine,
  gateway: OrderSubmissionGateway,
  companyId: string,
  commit: Commit,
): Promise<'ready' | 'created' | 'blocked'> => {
  const evidence = await assessNewRequest(gateway, companyId, line.idempotencyKey);
  if (evidence.decision === 'created') return 'created';
  if (evidence.decision === 'blocked') {
    line.submissionError = evidence.reason;
    commit();
    return 'blocked';
  }
  line.idempotencyKey = newIdempotencyKey();
  return 'ready';
};

/** Performs at most one POST with the caller's payload/key; any uncertain result stops sending. */
const processLine = async (
  line: PendingOrderLine,
  draft: OrderDraft,
  salesOrderNumber: string,
  mode: Mode,
  gateway: OrderSubmissionGateway,
  commit: Commit,
): Promise<LineOutcome> => {
  const eligible =
    mode === 'verify'
      ? line.submissionStatus === 'ambiguous'
      : line.submissionStatus !== 'ambiguous';
  if (!eligible) return mode === 'send' ? 'stop' : 'skip';
  if (mode === 'send' && line.submissionStatus === 'failed') {
    const preparation = await prepareLine(line, gateway, draft.dataAreaId, commit);
    if (preparation === 'created') return 'created';
    if (preparation === 'blocked') return 'stop';
  }
  line.submissionStatus = 'submitting';
  line.submissionError = null;
  commit();
  try {
    if (line.source === 'agreement')
      await gateway.createAgreementLine(
        mapAgreementLineRequest(draft, line, salesOrderNumber),
        line.idempotencyKey,
      );
    else
      await gateway.createNormalLine(
        mapNormalLineRequest(draft, line, salesOrderNumber),
        line.idempotencyKey,
      );
    return 'created';
  } catch (error) {
    applyLineFailure(line, error, commit);
    return mode === 'send' ? 'stop' : 'skip';
  }
};

type Options = {
  api: ApiClient;
  accountId: string;
  companyId: string;
  salesOrderNumber: string;
  draft: OrderDraft | null;
  paymentRequired: boolean;
  verifyPayment: () => Promise<boolean>;
  onMessage: (message: string | null) => void;
  onCompleted: () => void;
};

/** Owns recovery, persistence, exclusivity and sequential execution for an existing order. */
export const usePendingOrderLines = ({
  api,
  accountId,
  companyId,
  salesOrderNumber,
  draft,
  paymentRequired,
  verifyPayment,
  onMessage,
  onCompleted,
}: Options) => {
  const client = useQueryClient();
  const [pendingLines, setPendingLines] = useState<PendingOrderLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const storageKey = `sales4app.existingOrderPendingLines.v1:${accountId}:${companyId}:${salesOrderNumber}`;

  useEffect(() => {
    try {
      setPendingLines(restorePendingLines(sessionStorage.getItem(storageKey)));
    } catch {
      setPendingLines([]);
    }
  }, [storageKey]);
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(pendingLines));
  }, [pendingLines, storageKey]);
  useEffect(() => {
    if (!pendingLines.length) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pendingLines.length]);

  const refreshOrder = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: orderKeys.detail(companyId, salesOrderNumber) }),
      client.invalidateQueries({ queryKey: orderKeys.lines(companyId, salesOrderNumber) }),
      client.invalidateQueries({ queryKey: orderKeys.officialLines(companyId, salesOrderNumber) }),
      client.invalidateQueries({ queryKey: orderKeys.all(companyId) }),
    ]);

  const sendLines = async (
    currentDraft: OrderDraft,
    mode: Mode,
    source: PendingOrderLine[],
  ): Promise<PendingOrderLine[] | null> => {
    if (mode === 'send' && paymentRequired && !(await verifyPayment())) {
      onMessage(
        'Debe adjuntar un comprobante de pago en formato imagen antes de enviar líneas. No se realizó ningún POST de línea.',
      );
      return null;
    }
    setSubmitting(true);
    onMessage(null);
    const gateway = orderSubmissionService(api);
    const working = source.map((line) => ({ ...line }));
    const commit = () => {
      sessionStorage.setItem(storageKey, JSON.stringify(working));
      setPendingLines(working.map((line) => ({ ...line })));
    };
    const created = new Set<string>();
    for (const line of working) {
      const outcome = await processLine(
        line,
        currentDraft,
        salesOrderNumber,
        mode,
        gateway,
        commit,
      );
      if (outcome === 'created') created.add(line.localId);
      if (outcome === 'stop') break;
    }
    const remaining = working.filter((line) => !created.has(line.localId));
    working.splice(0, working.length, ...remaining);
    commit();
    await refreshOrder();
    setSubmitting(false);
    if (!remaining.length) {
      sessionStorage.removeItem(storageKey);
      onCompleted();
      return remaining;
    }
    onMessage(
      `${created.size} creada(s); ${remaining.length} pendiente(s). Las exitosas no se reenviarán.`,
    );
    return remaining;
  };

  const execute = async (mode: Mode) => {
    if (!draft || submitting || inFlight.current) return;
    if (mode === 'send' && !pendingLines.length) return;
    inFlight.current = true;
    try {
      const remaining = await sendLines(draft, mode, pendingLines);
      if (
        mode === 'verify' &&
        remaining?.length &&
        remaining.every((line) => line.submissionStatus === 'pending')
      )
        await sendLines(draft, 'send', remaining);
    } catch (error) {
      // Payment, persistence and cache failures must not leave the UI locked or start another POST.
      onMessage(mutationErrorMessage(error));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };
  return {
    pendingLines,
    setPendingLines,
    submitting,
    submitPending: () => execute('send'),
    verifyPendingLines: () => execute('verify'),
  };
};

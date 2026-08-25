import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useSession } from '../../app/providers/SessionProvider';
import { clearDraftStorage } from '../orderDraft/storage';
import { useOrderDraft } from '../orderDraft/OrderDraftProvider';
import { orderSubmissionService } from './orderSubmissionService';
import { SubmissionRunner } from './submissionRunner';
import { clearSubmission, loadSubmission } from './submissionStorage';
import type { OrderSubmission } from './types';
type Value = {
  submission: OrderSubmission | null;
  active: boolean;
  submit: () => Promise<void>;
  retryPending: () => Promise<void>;
  discardRecovery: () => void;
  createAnother: () => void;
};
const Context = createContext<Value | null>(null);
const activeStatus = new Set([
  'validating',
  'creating-header',
  'header-created',
  'uploading-attachments',
  'creating-lines',
  'recovering',
]);
export const OrderSubmissionProvider = ({ children }: { children: ReactNode }) => {
  const { api, context } = useSession();
  const { draft, attachments, clearAttachments, reset } = useOrderDraft();
  const [submission, setSubmission] = useState<OrderSubmission | null>(() =>
    loadSubmission(context.accountId, context.company?.id ?? ''),
  );
  const inFlight = useRef(false);
  const runner = useMemo(
    () => new SubmissionRunner(orderSubmissionService(api), setSubmission),
    [api],
  );
  const active = Boolean(submission && activeStatus.has(submission.status));
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (active) event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);
  const run = useCallback(
    async (recovery?: OrderSubmission | null) => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const result = await runner.submit(
          draft,
          recovery,
          attachments.map((item) => ({
            localId: item.localId,
            file: item.file,
            description: item.description,
          })),
        );
        setSubmission(result.submission);
        clearAttachments(result.submission.createdAttachmentIds ?? []);
        if (result.completed) clearDraftStorage();
      } finally {
        inFlight.current = false;
      }
    },
    [attachments, clearAttachments, draft, runner],
  );
  const submit = useCallback(() => run(null), [run]);
  const retryPending = useCallback(async () => {
    if (!submission?.salesOrderNumber) return;
    await run({
      ...submission,
      lines: submission.lines.map((line) =>
        line.status === 'created' ? line : { ...line, status: 'pending', error: null },
      ),
    });
  }, [run, submission]);
  const discardRecovery = useCallback(() => {
    clearSubmission(context.accountId, context.company!.id);
    setSubmission(null);
  }, [context.accountId, context.company]);
  const createAnother = useCallback(() => {
    clearSubmission(context.accountId, context.company!.id);
    setSubmission(null);
    reset();
  }, [context.accountId, context.company, reset]);
  const value = useMemo(
    () => ({ submission, active, submit, retryPending, discardRecovery, createAnother }),
    [submission, active, submit, retryPending, discardRecovery, createAnother],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
};
export const useOrderSubmission = () => {
  const value = useContext(Context);
  if (!value) throw new Error('useOrderSubmission must be inside provider');
  return value;
};

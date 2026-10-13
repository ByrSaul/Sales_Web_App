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
import { hasUnresolvedOperation } from './operationTracking';
import { orderSubmissionService } from './orderSubmissionService';
import { SubmissionRunner } from './submissionRunner';
import { clearSubmission, loadSubmission } from './submissionStorage';
import type { OrderSubmission, SubmissionResult } from './types';
type Value = {
  submission: OrderSubmission | null;
  /** Hay una solicitud HTTP de creación o verificación en curso en esta pestaña. */
  active: boolean;
  /** Algún comando del envío se está ejecutando; los botones deben deshabilitarse. */
  busy: boolean;
  /** Existe una creación cuyo resultado el Backend todavía no confirmó. */
  unresolved: boolean;
  submit: () => Promise<void>;
  verifyPending: () => Promise<void>;
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
/**
 * Proveedor que coordina y recupera el proceso persistente de envío de pedidos.
 *
 * Dependencias:
 * - `SubmissionRunner`.
 * - Gateway de envío de pedidos.
 * - Almacenamiento de la ejecución.
 */
export const OrderSubmissionProvider = ({ children }: { children: ReactNode }) => {
  const { api, context } = useSession();
  const { draft, attachments, clearAttachments, reset } = useOrderDraft();
  const [submission, setSubmission] = useState<OrderSubmission | null>(() =>
    loadSubmission(context.accountId, context.company?.id ?? ''),
  );
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const runner = useMemo(
    () => new SubmissionRunner(orderSubmissionService(api), setSubmission),
    [api],
  );
  const active = Boolean(submission && activeStatus.has(submission.status));
  const unresolved = Boolean(submission && hasUnresolvedOperation(submission));
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (active) event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);
  /** Ejecuta un comando a la vez: el doble clic nunca produce dos solicitudes. */
  const exclusive = useCallback(async (work: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await work();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);
  const settle = useCallback(
    (result: SubmissionResult) => {
      setSubmission(result.submission);
      clearAttachments(result.submission.createdAttachmentIds ?? []);
      // El borrador solo se elimina cuando no queda ninguna operación sin resolver.
      if (result.completed) clearDraftStorage();
    },
    [clearAttachments],
  );
  const execute = useCallback(
    async (recovery: OrderSubmission | null) =>
      settle(
        await runner.submit(
          draft,
          recovery,
          attachments.map((item) => ({
            localId: item.localId,
            file: item.file,
            description: item.description,
          })),
        ),
      ),
    [attachments, draft, runner, settle],
  );
  const submit = useCallback(() => exclusive(() => execute(null)), [exclusive, execute]);
  /**
   * Consulta en el Backend el estado de las creaciones sin resultado confirmado, con su mismo POST,
   * su misma `Idempotency-Key` y su mismo body. Nunca genera claves nuevas. Si todo quedó
   * `Completed`, continúa con las operaciones pendientes; un `Failed` espera la decisión del usuario.
   */
  const verifyPending = useCallback(
    () =>
      exclusive(async () => {
        if (!submission) return;
        settle(
          await runner.verifyAndResume(
            submission,
            draft,
            attachments.map((item) => ({
              localId: item.localId,
              file: item.file,
              description: item.description,
            })),
          ),
        );
      }),
    [attachments, draft, exclusive, runner, settle, submission],
  );
  /**
   * Reanuda la ejecución persistida o inicia una nueva solicitud tras un error. Está bloqueada
   * mientras exista una operación sin resultado confirmado. Una operación fallida solo recibe otra
   * clave cuando el Backend confirma que el intento anterior no produjo efectos en Dynamics.
   */
  const retryPending = useCallback(
    () =>
      exclusive(async () => {
        if (!submission || hasUnresolvedOperation(submission)) return;
        if (!submission.salesOrderNumber) {
          const assessed = await runner.assessHeaderRetry(submission);
          if (assessed.safe) {
            // Nueva solicitud: un envío nuevo con claves nuevas a partir del borrador vigente.
            clearSubmission(context.accountId, context.company!.id);
            await execute(null);
            return;
          }
          setSubmission(assessed.submission);
          // Si el Backend confirmó que el pedido existe, se continúa con sus líneas pendientes.
          if (assessed.submission.salesOrderNumber) await execute(assessed.submission);
          return;
        }
        await execute(await runner.prepareRetry(submission));
      }),
    [context.accountId, context.company, exclusive, execute, runner, submission],
  );
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
    () => ({
      submission,
      active,
      busy,
      unresolved,
      submit,
      verifyPending,
      retryPending,
      discardRecovery,
      createAnother,
    }),
    [submission, active, busy, unresolved, submit, verifyPending, retryPending, discardRecovery, createAnother],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
};
/** @returns Estado y comandos del envío de pedido en curso. */
export const useOrderSubmission = () => {
  const value = useContext(Context);
  if (!value) throw new Error('useOrderSubmission must be inside provider');
  return value;
};

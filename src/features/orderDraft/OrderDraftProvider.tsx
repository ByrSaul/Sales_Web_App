import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSession } from '../../app/providers/SessionProvider';
import { buildDraftLines, createOrderDraft, removeDraftLine, touch } from './domain';
import { clearDraftStorage, loadDraft, saveDraft } from './storage';
import type { NewLineSelection, OrderDraft } from './types';

type Value = {
  draft: OrderDraft;
  update: (patch: Partial<OrderDraft>) => void;
  addLines: (selection: NewLineSelection) => void;
  updateLine: (localId: string, patch: Partial<OrderDraft['lines'][number]>) => void;
  removeLine: (localId: string) => void;
  reset: () => void;
};
const Context = createContext<Value | null>(null);
export const OrderDraftProvider = ({ children }: { children: ReactNode }) => {
  const { context } = useSession();
  if (!context.company || !context.vendor || !context.user)
    throw new Error('OrderDraftProvider requires complete operational context');
  const fresh = useCallback(
    () => createOrderDraft(context.accountId, context.company!, context.vendor!, context.user!),
    [context.accountId, context.company, context.vendor, context.user],
  );
  const current = useCallback(() => {
    const restored = loadDraft(context.accountId, context.company!.id);
    return restored
      ? { ...restored, personnelnumber: context.user!.personnelnumber }
      : fresh();
  }, [context.accountId, context.company, context.user, fresh]);
  const [draft, setDraft] = useState<OrderDraft>(
    current,
  );
  useEffect(() => {
    setDraft(current());
  }, [current]);
  useEffect(() => {
    saveDraft(draft);
  }, [draft]);
  const update = useCallback(
    (patch: Partial<OrderDraft>) => setDraft((current) => touch({ ...current, ...patch })),
    [],
  );
  const addLines = useCallback(
    (selection: NewLineSelection) =>
      setDraft((current) =>
        touch({ ...current, lines: [...current.lines, ...buildDraftLines(current, selection)] }),
      ),
    [],
  );
  const updateLine = useCallback(
    (localId: string, patch: Partial<OrderDraft['lines'][number]>) =>
      setDraft((current) =>
        touch({
          ...current,
          lines: current.lines.map((line) =>
            line.localId === localId ? { ...line, ...patch } : line,
          ),
        }),
      ),
    [],
  );
  const removeLine = useCallback(
    (localId: string) =>
      setDraft((current) => touch({ ...current, lines: removeDraftLine(current.lines, localId) })),
    [],
  );
  const reset = useCallback(() => {
    clearDraftStorage();
    setDraft(fresh());
  }, [fresh]);
  const value = useMemo(
    () => ({ draft, update, addLines, updateLine, removeLine, reset }),
    [draft, update, addLines, updateLine, removeLine, reset],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
};
export const useOrderDraft = () => {
  const value = useContext(Context);
  if (!value) throw new Error('useOrderDraft must be inside OrderDraftProvider');
  return value;
};

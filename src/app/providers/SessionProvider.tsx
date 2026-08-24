import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { appConfig } from '../config/env';
import { ApiClient } from '../../core/api/apiClient';
import { userErrorMessage } from '../../core/api/errors';
import {
  clearOperationalContext,
  emptyOperationalContext,
  loadOperationalContext,
  saveOperationalContext,
} from '../../core/session/storage';
import type { Company, OperationalContext, Vendor } from '../../core/session/types';
import { withSelectedCompany, withoutCompany } from '../../core/session/transitions';
import { queryClient } from './queryClient';
import { sessionService } from '../../features/session/sessionService';
import { useAuth } from './AuthProvider';
import { clearDraftStorage } from '../../features/orderDraft/storage';
import { peekSubmission } from '../../features/orders/submissionStorage';

type SessionContextValue = {
  context: OperationalContext;
  api: ApiClient;
  selectCompany: (company: Company) => void;
  completeVendorSelection: (vendor: Vendor) => Promise<void>;
  changeCompany: () => void;
  logout: () => Promise<void>;
  operationError: string | null;
  clearOperationError: () => void;
};
const SessionContext = createContext<SessionContextValue | null>(null);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();
  const navigate = useNavigate();
  const accountId = auth.account?.homeAccountId ?? '';
  const [context, setContext] = useState<OperationalContext>(() =>
    emptyOperationalContext(accountId),
  );
  const [operationError, setOperationError] = useState<string | null>(null);

  useEffect(() => {
    setContext(accountId ? loadOperationalContext(accountId) : emptyOperationalContext());
  }, [accountId]);
  useEffect(() => {
    if (context.accountId) saveOperationalContext(context);
  }, [context]);

  const logout = useCallback(async () => {
    queryClient.clear();
    clearDraftStorage();
    clearOperationalContext();
    setContext(emptyOperationalContext());
    try {
      await auth.logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }, [auth, navigate]);

  const api = useMemo(
    () =>
      new ApiClient({
        baseUrl: appConfig.apiBaseUrl,
        getToken: auth.getAccessToken,
        onUnauthorized: auth.unauthorized,
        refreshOnUnauthorized: auth.canRefreshToken,
      }),
    [auth.getAccessToken, auth.unauthorized, auth.canRefreshToken],
  );

  const selectCompany = useCallback(
    (company: Company) => {
      setOperationError(null);
      const submission = peekSubmission(accountId);
      if (
        submission &&
        submission.companyId !== company.id &&
        [
          'validating',
          'creating-header',
          'header-created',
          'creating-lines',
          'recovering',
        ].includes(submission.status)
      ) {
        window.alert('No puede cambiar de empresa mientras se crea un pedido.');
        return;
      }
      if (
        (submission?.salesOrderNumber || submission?.headerAmbiguous) &&
        submission.status !== 'completed' &&
        submission.companyId !== company.id &&
        !window.confirm(
          `Existe una recuperación transaccional ${submission.salesOrderNumber ? `del pedido ${submission.salesOrderNumber}` : 'con encabezado de resultado ambiguo'} en ${submission.companyId}. No se eliminará. ¿Cambiar de empresa?`,
        )
      )
        return;
      if (context.company?.id && context.company.id !== company.id) clearDraftStorage();
      setContext(withSelectedCompany(accountId, company));
    },
    [accountId, context.company],
  );

  const completeVendorSelection = useCallback(
    async (vendor: Vendor) => {
      if (!context.company) throw new Error('Company is required');
      setOperationError(null);
      const service = sessionService(api);
      let warning: string | null = null;
      let user;
      try {
        user = await service.getUser();
      } catch {
        user = { id: '', name: '', language: 'SIN DATO', personnelnumber: '' };
        warning =
          'No se pudieron obtener idioma y número de personal. La creación de pedidos permanecerá bloqueada sin un número de personal real.';
      }
      try {
        const permissions = await service.getPermissions(context.company.id);
        setContext((current) => ({ ...current, vendor, user, permissions, warning }));
      } catch (error) {
        setOperationError(userErrorMessage(error));
        throw error;
      }
    },
    [api, context.company],
  );

  const changeCompany = useCallback(() => {
    const submission = peekSubmission(accountId);
    if (
      submission &&
      ['validating', 'creating-header', 'header-created', 'creating-lines', 'recovering'].includes(
        submission.status,
      )
    ) {
      window.alert('No puede cambiar de empresa mientras se crea un pedido.');
      return;
    }
    if (
      (submission?.salesOrderNumber || submission?.headerAmbiguous) &&
      submission.status !== 'completed' &&
      !window.confirm(
        `${submission.salesOrderNumber ? `El pedido ${submission.salesOrderNumber}` : 'Una creación de encabezado ambigua'} tiene recuperación pendiente. El estado se conservará para esta cuenta y empresa. ¿Continuar?`,
      )
    )
      return;
    queryClient.clear();
    clearDraftStorage();
    setContext(withoutCompany(accountId));
    navigate('/company');
  }, [accountId, navigate]);

  const value = useMemo(
    () => ({
      context,
      api,
      selectCompany,
      completeVendorSelection,
      changeCompany,
      logout,
      operationError,
      clearOperationError: () => setOperationError(null),
    }),
    [context, api, selectCompany, completeVendorSelection, changeCompany, logout, operationError],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionContextValue => {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
};

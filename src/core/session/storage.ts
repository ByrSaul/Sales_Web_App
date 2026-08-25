import type { OperationalContext } from './types';

const KEY = 'sales4app.operational-context.v1';
/** Construye un contexto operativo vacío para la cuenta autenticada indicada. */
export const emptyOperationalContext = (accountId = ''): OperationalContext => ({
  accountId,
  company: null,
  vendor: null,
  user: null,
  permissions: [],
  warning: null,
});

/** Recupera el contexto almacenado cuando pertenece a la cuenta autenticada. */
export const loadOperationalContext = (accountId: string): OperationalContext => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return emptyOperationalContext(accountId);
    const parsed = JSON.parse(raw) as OperationalContext;
    return parsed.accountId === accountId ? parsed : emptyOperationalContext(accountId);
  } catch {
    return emptyOperationalContext(accountId);
  }
};
/** Persiste el contexto operativo actual en almacenamiento de sesión. */
export const saveOperationalContext = (context: OperationalContext): void =>
  sessionStorage.setItem(KEY, JSON.stringify(context));
/** Elimina el contexto operativo persistido. */
export const clearOperationalContext = (): void => sessionStorage.removeItem(KEY);

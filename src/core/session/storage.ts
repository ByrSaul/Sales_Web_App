import type { OperationalContext } from './types';

const KEY = 'sales4app.operational-context.v1';
export const emptyOperationalContext = (accountId = ''): OperationalContext => ({
  accountId,
  company: null,
  vendor: null,
  user: null,
  permissions: [],
  warning: null,
});

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
export const saveOperationalContext = (context: OperationalContext): void =>
  sessionStorage.setItem(KEY, JSON.stringify(context));
export const clearOperationalContext = (): void => sessionStorage.removeItem(KEY);

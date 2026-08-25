import type { Company, OperationalContext } from './types';
/** Inicia un contexto con compañía y limpia selecciones dependientes anteriores. */
export const withSelectedCompany = (accountId: string, company: Company): OperationalContext => ({
  accountId,
  company,
  vendor: null,
  user: null,
  permissions: [],
  warning: null,
});
/** Restablece el contexto operativo para seleccionar nuevamente una compañía. */
export const withoutCompany = (accountId: string): OperationalContext => ({
  accountId,
  company: null,
  vendor: null,
  user: null,
  permissions: [],
  warning: null,
});

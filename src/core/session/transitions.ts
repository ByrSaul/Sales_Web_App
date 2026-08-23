import type { Company, OperationalContext } from './types';
export const withSelectedCompany = (accountId: string, company: Company): OperationalContext => ({
  accountId,
  company,
  vendor: null,
  user: null,
  permissions: [],
  warning: null,
});
export const withoutCompany = (accountId: string): OperationalContext => ({
  accountId,
  company: null,
  vendor: null,
  user: null,
  permissions: [],
  warning: null,
});

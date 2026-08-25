import { useMutation, useQuery } from '@tanstack/react-query';
import { useSession } from '../../app/providers/SessionProvider';
import { billingService } from './billingService';
import type { InvoiceFilters } from './billingTypes';
/** Claves de caché para facturas, estados de cuenta y antigüedad de saldos. */
export const billingKeys = {
  invoices: (c: string, v: string, f: InvoiceFilters) =>
    ['invoices', c, v, f.customer, f.from, f.to, f.openOnly, f.page] as const,
  statement: (c: string, a: string, m: boolean) => ['customer-statement', c, a, m] as const,
};
/** Consulta facturas para la compañía y el vendedor activos. */
export const useInvoices = (filters: InvoiceFilters) => {
  const { api, context } = useSession();
  const c = context.company?.id ?? '',
    v = context.vendor?.id ?? '';
  return useQuery({
    queryKey: billingKeys.invoices(c, v, filters),
    queryFn: ({ signal }) => billingService(api).invoices(c, v, filters, signal),
    enabled: Boolean(c && v),
    staleTime: 30_000,
  });
};
/** Consulta el estado de cuenta de un cliente y su resumen financiero. */
export const useStatement = (account: string, multi = false) => {
  const { api, context } = useSession();
  const c = context.company?.id ?? '';
  return useQuery({
    queryKey: billingKeys.statement(c, account, multi),
    queryFn: ({ signal }) => billingService(api).statement(c, account, multi, signal),
    enabled: Boolean(c && account),
    staleTime: 30_000,
  });
};
/** Expone mutaciones para generar y abrir reportes financieros en PDF. */
export const useReportService = () => {
  const { api, context } = useSession();
  const service = billingService(api);
  return {
    ...service,
    pdf: (_company: string, documentId: string) =>
      service.pdf(context.company?.id ?? '', documentId),
  };
};
/** Expone la mutación que obtiene la antigüedad de saldos desde SSRS. */
export const useAgingReport = () => {
  const { api, context } = useSession();
  return useMutation({
    mutationFn: (customerAccount: string) =>
      billingService(api).agingPdf(context.company?.id ?? '', customerAccount),
    retry: false,
  });
};

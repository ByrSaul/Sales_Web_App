import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../app/providers/SessionProvider';
import { orderQueryService } from './orderQueryService';
import { orderSubmissionService } from './orderSubmissionService';
import type { SalesLineRequest } from './types';
import type { OrderFilters, UpdateLineInput } from './orderTypes';

// Thrown when the main line was created but its linked bonus line failed — the two are
// sequential POSTs against an already-open order, never a single atomic operation.
export class BonusLineFailure extends Error {
  constructor(public readonly cause: unknown) {
    super('La línea principal se creó, pero la bonificación falló.');
    this.name = 'BonusLineFailure';
  }
}
export const orderKeys = {
  all: (company: string) => ['orders', company] as const,
  list: (company: string, vendor: string, filters: OrderFilters) =>
    ['orders', company, 'list', vendor, filters] as const,
  detail: (company: string, order: string) => ['orders', company, 'detail', order] as const,
  lines: (company: string, order: string) => ['order-lines', company, order] as const,
  officialLines: (company: string, order: string) =>
    ['orders', company, 'official-line', order] as const,
  officialLine: (company: string, order: string, lineNumber: number) =>
    [...orderKeys.officialLines(company, order), lineNumber] as const,
};
export const useOrders = (filters: OrderFilters, enabled = true) => {
  const { api, context } = useSession();
  const company = context.company?.id ?? '',
    vendor = context.vendor?.id ?? '';
  return useQuery({
    queryKey: orderKeys.list(company, vendor, filters),
    queryFn: ({ signal }) => orderQueryService(api).list(company, vendor, filters, signal),
    enabled: Boolean(enabled && company && vendor),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
};
export const useOrderDetail = (salesOrderNumber: string) => {
  const { api, context } = useSession();
  const company = context.company?.id ?? '';
  const header = useQuery({
    queryKey: orderKeys.detail(company, salesOrderNumber),
    queryFn: ({ signal }) => orderQueryService(api).header(company, salesOrderNumber, signal),
    enabled: Boolean(company && salesOrderNumber),
    staleTime: 15_000,
  });
  const lines = useQuery({
    queryKey: orderKeys.lines(company, salesOrderNumber),
    queryFn: ({ signal }) => orderQueryService(api).lines(company, salesOrderNumber, signal),
    enabled: Boolean(company && salesOrderNumber),
    staleTime: 15_000,
  });
  return { header, lines };
};
export const useOfficialOrderLine = (salesOrderNumber: string) => {
  const { api, context } = useSession();
  const qc = useQueryClient();
  const company = context.company?.id ?? '';
  return useMutation({
    mutationFn: (lineNumber: number) =>
      qc.fetchQuery({
        queryKey: orderKeys.officialLine(company, salesOrderNumber, lineNumber),
        queryFn: ({ signal }) =>
          orderQueryService(api).officialLine(company, salesOrderNumber, lineNumber, signal),
        staleTime: 0,
      }),
    retry: false,
  });
};
export const useOrderMutations = (salesOrderNumber: string) => {
  const { api, context } = useSession();
  const qc = useQueryClient();
  const company = context.company?.id ?? '';
  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: orderKeys.detail(company, salesOrderNumber) }),
      qc.invalidateQueries({ queryKey: orderKeys.lines(company, salesOrderNumber) }),
      qc.invalidateQueries({ queryKey: orderKeys.officialLines(company, salesOrderNumber) }),
      qc.invalidateQueries({ queryKey: orderKeys.all(company) }),
    ]);
  };
  return {
    update: useMutation({
      mutationFn: (input: UpdateLineInput) => orderQueryService(api).updateLine(input),
      retry: false,
      onSettled: invalidate,
    }),
    cancel: useMutation({
      mutationFn: (input: { companyId: string; inventoryLotId: string }) =>
        orderQueryService(api).cancelLine(input.companyId, input.inventoryLotId),
      retry: false,
      onSuccess: (result) => (result.success ? invalidate() : undefined),
    }),
    delete: useMutation({
      mutationFn: (input: { companyId: string; inventoryLotId: string }) =>
        orderQueryService(api).deleteLine(input.companyId, input.inventoryLotId),
      retry: false,
      onSuccess: invalidate,
    }),
    confirm: useMutation({
      mutationFn: () => orderQueryService(api).confirm(company, salesOrderNumber),
      retry: false,
      onSettled: invalidate,
    }),
    addLine: useMutation({
      mutationFn: async (input: { main: SalesLineRequest; bonus?: SalesLineRequest }) => {
        const gateway = orderSubmissionService(api);
        const main = await gateway.createNormalLine(input.main);
        if (!input.bonus) return { main, bonus: null };
        try {
          const bonus = await gateway.createNormalLine(input.bonus);
          return { main, bonus };
        } catch (bonusError) {
          throw new BonusLineFailure(bonusError);
        }
      },
      retry: false,
      onSettled: invalidate,
    }),
  };
};

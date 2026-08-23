import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../app/providers/SessionProvider';
import { productionService } from './productionService';
import type { ProductionFilters } from './productionTypes';
export const productionKey = (c: string, v: string, f: ProductionFilters) =>
  [
    'production',
    c,
    v,
    f.mode,
    f.customer,
    f.item,
    f.status,
    f.from,
    f.to,
    f.delivery,
    f.page,
  ] as const;
export const useProduction = (f: ProductionFilters) => {
  const { api, context } = useSession();
  const c = context.company?.id ?? '',
    v = context.vendor?.id ?? '';
  return useQuery({
    queryKey: productionKey(c, v, f),
    queryFn: ({ signal }) => productionService(api).list(c, v, f, signal),
    enabled: Boolean(c && v),
    staleTime: 30_000,
  });
};

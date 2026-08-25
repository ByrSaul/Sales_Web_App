import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../app/providers/SessionProvider';
import { forecastService } from './forecastService';
import type { ForecastFilters } from './forecastTypes';
/** Construye la clave estable de caché para una consulta de pronóstico. */
export const forecastKey = (c: string, v: string, f: ForecastFilters) =>
  ['forecast', c, v, f.from, f.to, f.item, f.variant, f.customer, f.view, f.page] as const;
/**
 * Consulta el pronóstico del vendedor y la compañía activos.
 *
 * Dependencias:
 * - TanStack Query.
 * - Contexto de sesión.
 * - `forecastService`.
 *
 * @param f Filtros y paginación del pronóstico.
 * @returns Estado de consulta y resultado paginado.
 */
export const useForecast = (f: ForecastFilters) => {
  const { api, context } = useSession();
  const c = context.company?.id ?? '',
    v = context.vendor?.id ?? '';
  return useQuery({
    queryKey: forecastKey(c, v, f),
    queryFn: ({ signal }) => forecastService(api).list(c, v, f, signal),
    enabled: Boolean(c && v),
    staleTime: 30_000,
  });
};

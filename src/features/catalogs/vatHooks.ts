import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { useSession } from '../../app/providers/SessionProvider';
import { vatService, type CreateVatInput } from './vatService';

/** Claves de caché para consultas de NIF/VAT y tipos documentales. */
export const vatKeys = {
  query: (company: string, country: string, search: string) => ['vat', company, country, search] as const,
  documents: (company: string, country: string) => ['vat-document-types', company, country] as const,
};
/** Consulta identificadores NIF/VAT por país y texto de búsqueda. */
export const useVatNumbers = (country: string, search: string, enabled: boolean) => {
  const { api, context } = useSession();
  const company = context.company?.id ?? '';
  const normalized = search.trim();
  const query = useInfiniteQuery({ queryKey: vatKeys.query(company, country, normalized), queryFn: ({ pageParam, signal }) => vatService(api).query(company, country, normalized, pageParam, signal), initialPageParam: 1, getNextPageParam: (last) => last.pagination.currentPage < last.pagination.totalPages ? last.pagination.currentPage + 1 : undefined, enabled: Boolean(enabled && company && country && normalized) });
  const items = Array.from(new Map(query.data?.pages.flatMap((page) => page.items).map((item) => [`${item.companyId}:${item.countryId}:${item.vatNumber}`, item])).values());
  return { ...query, items };
};
/** Consulta los tipos de documento fiscal disponibles para un país. */
export const useVatDocumentTypes = (country: string, enabled: boolean) => {
  const { api, context } = useSession();
  const company = context.company?.id ?? '';
  return useQuery({ queryKey: vatKeys.documents(company, country), queryFn: ({ signal }) => vatService(api).documentTypes(company, country, signal), enabled: Boolean(enabled && company && country) });
};
/** Devuelve la mutación utilizada para registrar un nuevo NIF/VAT. */
export const useCreateVat = () => {
  const { api } = useSession();
  return useMutation({ mutationFn: (input: CreateVatInput) => vatService(api).create(input), retry: false });
};

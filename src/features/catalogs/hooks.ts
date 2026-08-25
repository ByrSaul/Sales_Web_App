import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useSession } from '../../app/providers/SessionProvider';
import { catalogService } from './catalogService';
import { catalogKeys } from './queryKeys';
import type { Product } from './types';

export const useCustomers = (search: string, page: number) => {
  const { api, context } = useSession();
  const company = context.company?.id ?? '',
    vendor = context.vendor?.id ?? '';
  return useQuery({
    queryKey: catalogKeys.customers(company, vendor, search, page),
    queryFn: ({ signal }) =>
      catalogService(api).customers({
        company,
        salesGroup: vendor,
        search,
        page,
        perPage: 12,
        signal,
      }),
    enabled: Boolean(company && vendor && search.trim().length >= 1),
    placeholderData: keepPreviousData,
  });
};
export const useCustomerAddresses = (account: string) => {
  const { api, context } = useSession();
  const company = context.company?.id ?? '';
  return useQuery({
    queryKey: catalogKeys.addresses(company, account),
    queryFn: ({ signal }) => catalogService(api).customerAddresses(company, account, { signal }),
    enabled: Boolean(company && account),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  });
};
export const useProducts = (search: string, page: number) => {
  const { api, context } = useSession();
  const company = context.company?.id ?? '';
  return useQuery({
    queryKey: catalogKeys.products(company, search, page),
    queryFn: ({ signal }) =>
      catalogService(api).products({ company, search, page, perPage: 10, signal }),
    enabled: Boolean(company && search.trim().length >= 1),
    placeholderData: keepPreviousData,
  });
};
export const useInfiniteCustomers = (search: string) => {
  const { api, context } = useSession();
  const company = context.company?.id ?? '';
  const vendor = context.vendor?.id ?? '';
  const normalizedSearch = search.trim();
  const query = useInfiniteQuery({
    queryKey: catalogKeys.infiniteCustomers(company, vendor, normalizedSearch),
    queryFn: ({ pageParam, signal }) =>
      catalogService(api).customers({
        company,
        salesGroup: vendor,
        search: normalizedSearch,
        page: pageParam,
        perPage: 25,
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.currentPage < last.pagination.totalPages
        ? last.pagination.currentPage + 1
        : undefined,
    enabled: Boolean(company && vendor && normalizedSearch.length >= 1),
  });
  const items = Array.from(
    new Map(
      query.data?.pages
        .flatMap((page) => page.items)
        .map((item) => [`${item.companyId}:${item.account}`, item]),
    ).values(),
  );
  return { ...query, items };
};
export const useCustomerByAccount = (account: string) => {
  const { api, context } = useSession();
  const company = context.company?.id ?? '',
    vendor = context.vendor?.id ?? '';
  return useQuery({
    queryKey: catalogKeys.customer(company, vendor, account),
    queryFn: async ({ signal }) => {
      const result = await catalogService(api).customers({
        company,
        salesGroup: vendor,
        search: account,
        page: 1,
        perPage: 25,
        signal,
      });
      return result.items.find((customer) => customer.account === account) ?? null;
    },
    enabled: Boolean(company && vendor && account),
  });
};
export const useInfiniteProducts = (search: string, forceRegistry = false) => {
  const { api, context } = useSession();
  const company = context.company?.id ?? '';
  const query = useInfiniteQuery({
    queryKey: catalogKeys.infiniteProducts(company, search, forceRegistry),
    queryFn: ({ pageParam, signal }) =>
      catalogService(api).products({
        company,
        search,
        page: pageParam,
        perPage: 10,
        forceRegistry,
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.currentPage < last.pagination.totalPages
        ? last.pagination.currentPage + 1
        : undefined,
      enabled: Boolean(company),
  });
  const items = Array.from(
    new Map(query.data?.pages.flatMap((page) => page.items).map((item) => [item.itemId, item])).values(),
  );
  return { ...query, items };
};
export const useVariants = (
  product: Product | null,
  options: { forceRegistry?: boolean; regionId?: string } = {},
) => {
  const { api, context } = useSession();
  const company = context.company?.id ?? '';
  return useQuery({
    queryKey: catalogKeys.variants(
      company,
      product?.itemId ?? '',
      options.forceRegistry ?? false,
      options.regionId ?? '',
    ),
    queryFn: ({ signal }) =>
      catalogService(api).variants({
        company,
        itemId: product!.itemId,
        forceRegistry: options.forceRegistry,
        regionId: options.regionId,
        signal,
      }),
    enabled: Boolean(
      company &&
        product?.requiresVariant &&
        (!options.forceRegistry || options.regionId),
    ),
  });
};
export const useInventory = (product: Product | null, variantNumber: string, page: number) => {
  const { api, context } = useSession();
  const company = context.company?.id ?? '',
    vendor = context.vendor?.id ?? '';
  return useQuery({
    queryKey: catalogKeys.inventory(company, vendor, product?.itemId ?? '', variantNumber, page),
    queryFn: ({ signal }) =>
      product?.requiresVariant
        ? catalogService(api).variantInventory({
            company,
            salesGroup: vendor,
            itemId: product.itemId,
            displayProductNumber: variantNumber,
            page,
            signal,
          })
        : catalogService(api).inventory({
            company,
            salesGroup: vendor,
            itemId: product?.itemId,
            page,
            signal,
          }),
    enabled: Boolean(company && vendor && product && (!product.requiresVariant || variantNumber)),
    placeholderData: keepPreviousData,
  });
};
export const useInfiniteInventoryLocations = (
  company: string,
  salesGroup: string,
  enabled: boolean,
) => {
  const { api } = useSession();
  const query = useInfiniteQuery({
    queryKey: catalogKeys.inventoryLocations(company, salesGroup),
    queryFn: ({ pageParam, signal }) =>
      catalogService(api).inventoryLocations({
        company,
        salesGroup,
        page: pageParam,
        perPage: 25,
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.currentPage < last.pagination.totalPages
        ? last.pagination.currentPage + 1
        : undefined,
    enabled: Boolean(enabled && company && salesGroup),
  });
  const items = Array.from(
    new Map(query.data?.pages.flatMap((page) => page.items).map((item) => [item.id, item])).values(),
  );
  return { ...query, items };
};
export const useReferenceCatalogs = (
  customerAccount = '',
  countryId = '',
  enabled: {
    delivery?: boolean;
    origins?: boolean;
    promotions?: boolean;
    agreements?: boolean;
    documents?: boolean;
  } = {},
) => {
  const { api, context } = useSession();
  const company = context.company?.id ?? '';
  return {
    delivery: useQuery({
      queryKey: catalogKeys.catalog('delivery', company),
      queryFn: ({ signal }) => catalogService(api).deliveryModes(company, { signal }),
      enabled: Boolean(company && enabled.delivery !== false),
    }),
    origins: useQuery({
      queryKey: catalogKeys.catalog('origins', company),
      queryFn: ({ signal }) => catalogService(api).salesOrigins(company, { signal }),
      enabled: Boolean(company && enabled.origins !== false),
    }),
    promotions: useQuery({
      queryKey: catalogKeys.catalog('promotions', company),
      queryFn: ({ signal }) => catalogService(api).promotions(company, { signal }),
      enabled: Boolean(company && enabled.promotions !== false),
    }),
    agreements: useQuery({
      queryKey: catalogKeys.catalog('agreements', company, customerAccount),
      queryFn: ({ signal }) => catalogService(api).agreements(company, customerAccount, { signal }),
      enabled: Boolean(company && customerAccount && enabled.agreements !== false),
    }),
    documents: useQuery({
      queryKey: catalogKeys.catalog('documents', company, countryId),
      queryFn: ({ signal }) => catalogService(api).documentTypes(company, countryId, { signal }),
      enabled: Boolean(company && countryId && enabled.documents !== false),
    }),
  };
};

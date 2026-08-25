/**
 * Fábrica centralizada de claves de caché para catálogos comerciales.
 *
 * Mantiene aislamiento por compañía, vendedor, filtros y paginación.
 */
export const catalogKeys = {
  customers: (
    company: string,
    vendor: string,
    search: string,
    page: number) =>
      [
        'customers',
        company,
        vendor,
        search,
        page
      ] as const,
  infiniteCustomers: (company: string, vendor: string, search: string) =>
    ['customers', company, vendor, 'infinite', search] as const,
  customer: (company: string, vendor: string, account: string) =>
    ['customer', company, vendor, account] as const,
  addresses: (company: string, account: string) =>
    ['customer-addresses', company, account] as const,
  products: (company: string, search: string, page: number) =>
    ['products', company, search, page] as const,
  infiniteProducts: (company: string, search: string, forceRegistry: boolean) =>
    ['products', company, 'infinite', search, forceRegistry] as const,
  variants: (company: string, item: string, forceRegistry = false, regionId = '') =>
    ['variants', company, item, forceRegistry, regionId] as const,
  inventory: (company: string, vendor: string, item: string, variant: string, page: number) =>
    ['inventory', company, vendor, item, variant, page] as const,
  inventoryLocations: (company: string, salesGroup: string) =>
    ['inventory-locations', company, salesGroup] as const,
  price: (
    company: string,
    customer: string,
    currency: string,
    item: string,
    variant: {
      configId: string;
      colorId: string;
      sizeId: string;
      styleId: string;
      versionId: string;
    } | null,
  ) =>
    [
      'price',
      company,
      customer,
      currency,
      item,
      variant?.configId ?? '',
      variant?.colorId ?? '',
      variant?.sizeId ?? '',
      variant?.styleId ?? '',
      variant?.versionId ?? '',
    ] as const,
  geography: (level: string, ...parents: string[]) => ['geography', level, ...parents] as const,
  catalog: (name: string, company: string, ...params: string[]) =>
    ['catalog', name, company, ...params] as const,
};

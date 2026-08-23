export const catalogKeys = {
  customers: (company: string, vendor: string, search: string, page: number) => ['customers', company, vendor, search, page] as const,
  addresses: (company: string, account: string) => ['customer-addresses', company, account] as const,
  products: (company: string, search: string, page: number) => ['products', company, search, page] as const,
  variants: (company: string, item: string) => ['variants', company, item] as const,
  inventory: (company: string, vendor: string, item: string, variant: string, page: number) => ['inventory', company, vendor, item, variant, page] as const,
  price: (company: string, customer: string, currency: string, item: string, variant: { configId: string; colorId: string; sizeId: string; styleId: string; versionId: string } | null) => ['price', company, customer, currency, item, variant?.configId ?? '', variant?.colorId ?? '', variant?.sizeId ?? '', variant?.styleId ?? '', variant?.versionId ?? ''] as const,
  geography: (level: string, ...parents: string[]) => ['geography', level, ...parents] as const,
  catalog: (name: string, company: string, ...params: string[]) => ['catalog', name, company, ...params] as const,
};

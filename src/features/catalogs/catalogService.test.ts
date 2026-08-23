import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../core/api/apiClient';
import { catalogService } from './catalogService';
const api = (postResult: unknown = {}, getResult: unknown = {}) =>
  ({
    post: vi.fn().mockResolvedValue(postResult),
    get: vi.fn().mockResolvedValue(getResult),
  }) as unknown as ApiClient;
describe('catalogService', () => {
  it('builds customer request with company, vendor and pagination', async () => {
    const client = api({ customers: [], pagination: { CurrentPage: 2, TotalPages: 3 } });
    const result = await catalogService(client).customers({
      company: 'cmp',
      salesGroup: 'v1',
      search: 'agro',
      page: 2,
      perPage: 25,
    });
    expect(client.post).toHaveBeenCalledWith(
      '/customer/data',
      {
        company: 'cmp',
        sales_group: 'v1',
        search_text: 'agro',
        pagination: { page: 2, perpage: 25 },
      },
      expect.objectContaining({ company: 'cmp' }),
    );
    expect(result.pagination).toMatchObject({ currentPage: 2, totalPages: 3 });
  });
  it('identifies MasterProduct and maps normal products', async () => {
    const client = api({
      products: [
        { itemid: '1', name: 'Master', producttype: 'MasterProduct' },
        { itemid: '2', producttype: 'Item' },
      ],
      pagination: {},
    });
    const result = await catalogService(client).products({
      company: 'cmp',
      search: '',
      page: 1,
      perPage: 10,
    });
    expect(result.items.map((x) => x.requiresVariant)).toEqual([true, false]);
  });
  it('builds the exact variant request', async () => {
    const client = api({ variants: [], pagination: {} });
    await catalogService(client).variants({ company: 'cmp', itemId: 'P1' });
    expect(client.post).toHaveBeenCalledWith(
      '/company/products/variants',
      {
        company: 'cmp',
        itemid: 'P1',
        pagination: { page: 1, perpage: 100 },
        force_registry: 'false',
      },
      expect.anything(),
    );
  });
  it('supports simple and variant inventory contracts', async () => {
    const simple = api({ inventory: [], pagination: {} });
    await catalogService(simple).inventory({ company: 'cmp', salesGroup: 'v', itemId: 'P1' });
    expect(simple.post).toHaveBeenCalledWith(
      '/inventory',
      expect.objectContaining({ company: 'cmp', sales_group: 'v', itemid: 'P1' }),
      expect.anything(),
    );
    const variant = api({ inventory: [], pagination: {} });
    await catalogService(variant).variantInventory({
      company: 'cmp',
      salesGroup: 'v',
      itemId: 'P1',
      displayProductNumber: 'P1-01',
    });
    expect(variant.post).toHaveBeenCalledWith(
      '/inventory/variant',
      expect.objectContaining({ variantproduct: 'P1-01', by_warehouse: true }),
      expect.anything(),
    );
  });
  it('preserves the Dynamics price request casing', async () => {
    const client = api({ Success: true, Price: 12 });
    const result = await catalogService(client).getPrice({
      company: 'cmp',
      currency: 'USD',
      itemId: 'P1',
      customerAccount: 'C1',
      sizeId: 'L',
    });
    expect(client.post).toHaveBeenCalledWith(
      '/d365_services/get_price',
      expect.objectContaining({
        Company: 'cmp',
        Currencycode: 'USD',
        ItemId: 'P1',
        CustAccount: 'C1',
        InventSizeId: 'L',
      }),
      expect.anything(),
    );
    expect(result.price).toBe(12);
  });
  it('builds geographic GET bodies with parent filters', async () => {
    const client = api({}, { '@odata': [] });
    await catalogService(client).cities('GT', 'GUA', '0101');
    expect(client.get).toHaveBeenCalledWith(
      '/d365/address/cities',
      expect.objectContaining({
        body: expect.objectContaining({
          filters: { CountryRegionId: ['GT'], StateId: ['GUA'], CountyId: ['0101'] },
        }),
      }),
    );
  });
});

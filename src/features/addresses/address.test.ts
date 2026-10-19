import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../core/api/apiClient';
import {
  emptyGeography,
  selectCity,
  selectCountry,
  selectCounty,
  selectState,
} from '../catalogs/geography';
import { addressService, geographyBrowserCompatible, geographyMappers, mapCreateAddress } from './addressService';
describe('address safety', () => {
  it('maps the exact Mobile create payload', () =>
    expect(
      mapCreateAddress('CO', {
        customerAccount: 'C1',
        countryId: 'GT',
        stateId: '01',
        countyId: '0101',
        cityId: 'GUA',
        zipCode: '01001',
        description: ' Casa ',
        street: ' Calle ',
      }),
    ).toEqual({
      CustomerLegalEntityId: 'CO',
      CustomerAccountNumber: 'C1',
      AddressCountryRegionId: 'GT',
      AddressState: '01',
      AddressCountyId: '0101',
      AddressCity: 'GUA',
      AddressZipCode: '01001',
      AddressDescription: 'Casa',
      AddressStreet: 'Calle',
    }));
  it('uses browser-compatible POST geography queries and maps their pagination', async () => {
    const post = vi.fn().mockResolvedValue({
      '@odata': [{ CountryRegionId: 'GT', LongName: 'Guatemala', ShortName: 'GT' }],
      pagination: { CurrentPage: 2, PerPage: 10, TotalRecords: 15, TotalPages: 2 },
    });
    const body = { filters: {}, page: 2, perpage: 10 };
    const { signal } = new AbortController();
    const result = await addressService({ post } as unknown as ApiClient).geography(
      '/d365/address/country_regions', body, geographyMappers.country, signal,
    );
    expect(geographyBrowserCompatible).toBe(true);
    expect(post).toHaveBeenCalledWith('/d365/address/country_regions', body, { signal });
    expect(result.items).toEqual([{ id: 'GT', longName: 'Guatemala', shortName: 'GT' }]);
    expect(result.pagination).toMatchObject({ currentPage: 2, totalPages: 2, totalRecords: 15 });
  });
  it('clears every geographic descendant', () => {
    let g = {
      ...emptyGeography,
      countryId: 'GT',
      stateId: '01',
      countyId: '0101',
      cityId: 'GUA',
      zipCode: '01001',
    };
    expect(selectCountry(g, 'SV')).toEqual({ ...emptyGeography, countryId: 'SV' });
    g = selectState(g, '02');
    expect(g).toMatchObject({
      countryId: 'GT',
      stateId: '02',
      countyId: '',
      cityId: '',
      zipCode: '',
    });
    g = { ...g, countyId: 'X', cityId: 'Y', zipCode: 'Z' };
    expect(selectCounty(g, 'N')).toMatchObject({ countyId: 'N', cityId: '', zipCode: '' });
    expect(selectCity({ ...g, zipCode: 'Z' }, 'C').zipCode).toBe('');
  });
});

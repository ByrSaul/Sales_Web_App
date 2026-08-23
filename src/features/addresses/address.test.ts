import { describe, expect, it } from 'vitest';
import {
  emptyGeography,
  selectCity,
  selectCountry,
  selectCounty,
  selectState,
} from '../catalogs/geography';
import { geographyBrowserCompatible, mapCreateAddress } from './addressService';
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
  it('marks geographic GET-body catalogs browser-incompatible', () =>
    expect(geographyBrowserCompatible).toBe(false));
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

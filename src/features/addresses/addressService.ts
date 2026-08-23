import type { ApiClient } from '../../core/api/apiClient';
export type AddressForm = {
  customerAccount: string;
  countryId: string;
  stateId: string;
  countyId: string;
  cityId: string;
  zipCode: string;
  description: string;
  street: string;
};
export const mapCreateAddress = (company: string, f: AddressForm) => ({
  CustomerLegalEntityId: company,
  CustomerAccountNumber: f.customerAccount,
  AddressCountryRegionId: f.countryId,
  ...(f.stateId ? { AddressState: f.stateId } : {}),
  ...(f.countyId ? { AddressCountyId: f.countyId } : {}),
  ...(f.cityId ? { AddressCity: f.cityId } : {}),
  ...(f.zipCode ? { AddressZipCode: f.zipCode } : {}),
  AddressDescription: f.description.trim(),
  AddressStreet: f.street.trim(),
});
export const addressService = (api: ApiClient) => ({
  create: (company: string, form: AddressForm) =>
    api.post('/d365/address', mapCreateAddress(company, form)),
});
export const geographyBrowserCompatible = false;

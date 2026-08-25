import type { ApiClient } from '../../core/api/apiClient';
import type { City, Country, County, CustomerAddress, Pagination, State, ZipCode } from '../catalogs/types';
/** Datos capturados para crear una dirección de cliente en D365. */
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
/**
 * Traduce el formulario Web al contrato requerido para crear una dirección.
 *
 * @param company Compañía operativa seleccionada.
 * @param f Valores del formulario de dirección.
 * @returns Payload compatible con el endpoint de direcciones.
 */
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
/**
 * Servicio de creación de direcciones y consulta de catálogos geográficos.
 *
 * Endpoints utilizados:
 * - `POST /d365/address`
 * - `POST /d365/address/country_regions`
 * - `POST /d365/address/states`
 * - `POST /d365/address/counties`
 * - `POST /d365/address/cities`
 * - `POST /d365/address/zip_codes`
 *
 * @param api Cliente HTTP autenticado.
 * @returns Operaciones de direcciones y geografía.
 */
export const addressService = (api: ApiClient) => ({
  async create(company: string, form: AddressForm): Promise<CustomerAddress> {
    const response = await api.post<unknown>('/d365/address', mapCreateAddress(company, form));
    const envelope = response as Record<string, unknown>;
    const candidates = Array.isArray(response)
      ? response
      : Array.isArray(envelope['@odata'])
        ? envelope['@odata']
        : [response];
    const item = candidates[0] as Record<string, unknown> | undefined;
    if (!item || !String(item.AddressLocationId ?? '').trim())
      throw new Error('La respuesta no contiene AddressLocationId.');
    return {
      locationId: String(item.AddressLocationId),
      description: String(item.AddressDescription ?? form.description),
      formattedAddress: String(item.FormattedAddress ?? form.street),
      roles: String(item.AddressLocationRoles ?? 'Delivery'),
      countryId: String(item.AddressCountryRegionId ?? form.countryId),
      recId: Number(item.RecId ?? 0),
    };
  },
  async geography<T>(path: string, body: object, mapper: (item: Record<string, unknown>) => T, signal?: AbortSignal) {
    const response = await api.post<Record<string, unknown>>(path, body, { signal });
    const items = Array.isArray(response['@odata']) ? response['@odata'] as Record<string, unknown>[] : [];
    const raw = (response.pagination ?? {}) as Record<string, unknown>;
    const pagination: Pagination = {
      currentPage: Number(raw.CurrentPage ?? 1), perPage: Number(raw.PerPage ?? 25),
      fromRecord: Number(raw.FromRecord ?? 0), toRecord: Number(raw.ToRecord ?? 0),
      totalRecords: Number(raw.TotalRecords ?? items.length), totalPages: Number(raw.TotalPages ?? 1),
    };
    return { items: items.map(mapper), pagination };
  },
});
export const geographyMappers = {
  country: (j: Record<string, unknown>): Country => ({ id: String(j.CountryRegionId ?? ''), longName: String(j.LongName ?? ''), shortName: String(j.ShortName ?? '') }),
  state: (j: Record<string, unknown>): State => ({ id: String(j.State ?? ''), name: String(j.Name ?? '') }),
  county: (j: Record<string, unknown>): County => ({ id: String(j.CountyId ?? ''), description: String(j.Description ?? '') }),
  city: (j: Record<string, unknown>): City => ({ id: String(j.Name ?? ''), description: String(j.Description ?? '') }),
  zip: (j: Record<string, unknown>): ZipCode => ({ code: String(j.ZipCode ?? ''), countryId: String(j.CountryRegionId ?? ''), stateId: String(j.State ?? ''), countyId: String(j.County ?? ''), cityId: String(j.City ?? '') }),
};
export const geographyBrowserCompatible = true;

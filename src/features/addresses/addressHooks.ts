import { useMutation, useQuery } from '@tanstack/react-query';
import { useSession } from '../../app/providers/SessionProvider';
import { addressService, geographyMappers, type AddressForm } from './addressService';

const body = (filters: object, page = 1) => ({ filters, page, perpage: 100 });
export const addressKeys = {
  countries: ['address', 'countries'] as const,
  states: (country: string) => ['address', 'states', country] as const,
  counties: (country: string, state: string) => ['address', 'counties', country, state] as const,
  cities: (country: string, state: string, county: string) => ['address', 'cities', country, state, county] as const,
  zip: (country: string, state: string, county: string, city: string) => ['address', 'zip', country, state, county, city] as const,
};
export const useAddressGeography = (open: boolean, country: string, state: string, county: string, city: string) => {
  const { api } = useSession();
  const service = addressService(api);
  return {
    countries: useQuery({ queryKey: addressKeys.countries, queryFn: ({ signal }) => service.geography('/d365/address/country_regions', body({}), geographyMappers.country, signal), enabled: open }),
    states: useQuery({ queryKey: addressKeys.states(country), queryFn: ({ signal }) => service.geography('/d365/address/states', body({ CountryRegionId: [country] }), geographyMappers.state, signal), enabled: open && Boolean(country) }),
    counties: useQuery({ queryKey: addressKeys.counties(country, state), queryFn: ({ signal }) => service.geography('/d365/address/counties', body({ CountryRegionId: [country], StateId: [state] }), geographyMappers.county, signal), enabled: open && Boolean(country && state) }),
    cities: useQuery({ queryKey: addressKeys.cities(country, state, county), queryFn: ({ signal }) => service.geography('/d365/address/cities', body({ CountryRegionId: [country], StateId: [state], CountyId: [county] }), geographyMappers.city, signal), enabled: open && Boolean(country && state && county) }),
    zipCodes: useQuery({ queryKey: addressKeys.zip(country, state, county, city), queryFn: ({ signal }) => service.geography('/d365/address/zip_codes', { filters: { CountryRegionId: [country], State: [state], County: [county], City: [city] } }, geographyMappers.zip, signal), enabled: open && Boolean(country && state && county && city) }),
  };
};
export const useCreateAddress = () => {
  const { api, context } = useSession();
  return useMutation({ mutationFn: (form: AddressForm) => addressService(api).create(context.company?.id ?? '', form), retry: false });
};

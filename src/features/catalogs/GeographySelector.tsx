import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../app/providers/SessionProvider';
import { Select } from '../../components/ui';
import { catalogService } from './catalogService';
import { catalogKeys } from './queryKeys';
import {
  selectCity,
  selectCountry,
  selectCounty,
  selectState,
  type GeographySelection,
} from './geography';
export const GeographySelector: React.FC<{
  value: GeographySelection;
  onChange: (value: GeographySelection) => void;
}> = ({ value, onChange }) => {
  const { api } = useSession();
  const service = catalogService(api);
  const countries = useQuery({
    queryKey: catalogKeys.geography('countries'),
    queryFn: ({ signal }) => service.countries('', { signal }),
  });
  const states = useQuery({
    queryKey: catalogKeys.geography('states', value.countryId),
    queryFn: ({ signal }) => service.states(value.countryId, { signal }),
    enabled: Boolean(value.countryId),
  });
  const counties = useQuery({
    queryKey: catalogKeys.geography('counties', value.countryId, value.stateId),
    queryFn: ({ signal }) => service.counties(value.countryId, value.stateId, { signal }),
    enabled: Boolean(value.countryId && value.stateId),
  });
  const cities = useQuery({
    queryKey: catalogKeys.geography('cities', value.countryId, value.stateId, value.countyId),
    queryFn: ({ signal }) =>
      service.cities(value.countryId, value.stateId, value.countyId, { signal }),
    enabled: Boolean(value.countryId && value.stateId && value.countyId),
  });
  const zips = useQuery({
    queryKey: catalogKeys.geography(
      'zips',
      value.countryId,
      value.stateId,
      value.countyId,
      value.cityId,
    ),
    queryFn: ({ signal }) =>
      service.zipCodes(value.countryId, value.stateId, value.countyId, value.cityId, { signal }),
    enabled: Boolean(value.countryId && value.stateId && value.countyId && value.cityId),
  });
  const opts = (items: { value: string; label: string }[]) => [
    { value: '', label: 'Seleccionar...' },
    ...items,
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
      <Select
        label="País"
        value={value.countryId}
        onChange={(e) => onChange(selectCountry(value, e.target.value))}
        options={opts(
          (countries.data ?? []).map((x) => ({ value: x.id, label: x.shortName || x.longName })),
        )}
      />
      <Select
        label="Estado"
        disabled={!value.countryId}
        value={value.stateId}
        onChange={(e) => onChange(selectState(value, e.target.value))}
        options={opts((states.data ?? []).map((x) => ({ value: x.id, label: x.name })))}
      />
      <Select
        label="Municipio"
        disabled={!value.stateId}
        value={value.countyId}
        onChange={(e) => onChange(selectCounty(value, e.target.value))}
        options={opts((counties.data ?? []).map((x) => ({ value: x.id, label: x.description })))}
      />
      <Select
        label="Ciudad"
        disabled={!value.countyId}
        value={value.cityId}
        onChange={(e) => onChange(selectCity(value, e.target.value))}
        options={opts((cities.data ?? []).map((x) => ({ value: x.id, label: x.description })))}
      />
      <Select
        label="Código postal"
        disabled={!value.cityId}
        value={value.zipCode}
        onChange={(e) => onChange({ ...value, zipCode: e.target.value })}
        options={opts((zips.data ?? []).map((x) => ({ value: x.code, label: x.code })))}
      />
    </div>
  );
};

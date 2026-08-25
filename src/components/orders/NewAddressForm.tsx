import { useState } from 'react';
import { useAddressGeography, useCreateAddress } from '../../features/addresses/addressHooks';
import type { CustomerAddress } from '../../features/catalogs/types';
import { Button, Input, Select } from '../ui';

type Props = {
  customerAccount: string;
  onCancel: () => void;
  onCreated: (address: CustomerAddress) => void;
};

export const NewAddressForm = ({ customerAccount, onCancel, onCreated }: Props) => {
  const [countryId, setCountryId] = useState('');
  const [stateId, setStateId] = useState('');
  const [countyId, setCountyId] = useState('');
  const [cityId, setCityId] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [description, setDescription] = useState('');
  const [street, setStreet] = useState('');
  const [error, setError] = useState('');
  const geography = useAddressGeography(true, countryId, stateId, countyId, cityId);
  const create = useCreateAddress();

  const submit = async () => {
    if (!description.trim() || !street.trim() || !countryId || !zipCode) {
      setError('Complete descripción, calle, país y código postal.');
      return;
    }
    setError('');
    try {
      const address = await create.mutateAsync({ customerAccount, countryId, stateId, countyId, cityId, zipCode, description, street });
      onCreated(address);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible crear la dirección.');
    }
  };

  const options = (loading: boolean, values: { value: string; label: string }[]) => [
    { value: '', label: loading ? 'Cargando...' : 'Seleccione...' },
    ...values,
  ];

  return (
    <div className="space-y-3 rounded-lg border border-outline-variant p-3">
      <h3 className="text-sm font-bold">Nueva dirección</h3>
      <Input label="Descripción" value={description} onChange={(event) => setDescription(event.target.value)} />
      <Input label="Calle" value={street} onChange={(event) => setStreet(event.target.value)} />
      <Select label="País" value={countryId} onChange={(event) => { setCountryId(event.target.value); setStateId(''); setCountyId(''); setCityId(''); setZipCode(''); }} options={options(geography.countries.isLoading, (geography.countries.data?.items ?? []).map((item) => ({ value: item.id, label: `${item.id} · ${item.longName}` })))} />
      <Select label="Estado/departamento" disabled={!countryId} value={stateId} onChange={(event) => { setStateId(event.target.value); setCountyId(''); setCityId(''); setZipCode(''); }} options={options(geography.states.isLoading, (geography.states.data?.items ?? []).map((item) => ({ value: item.id, label: `${item.id} · ${item.name}` })))} />
      <Select label="Municipio/condado" disabled={!stateId} value={countyId} onChange={(event) => { setCountyId(event.target.value); setCityId(''); setZipCode(''); }} options={options(geography.counties.isLoading, (geography.counties.data?.items ?? []).map((item) => ({ value: item.id, label: `${item.id} · ${item.description}` })))} />
      <Select label="Ciudad" disabled={!countyId} value={cityId} onChange={(event) => { setCityId(event.target.value); setZipCode(''); }} options={options(geography.cities.isLoading, (geography.cities.data?.items ?? []).map((item) => ({ value: item.id, label: item.description || item.id })))} />
      <Select label="Código postal" disabled={!cityId} value={zipCode} onChange={(event) => setZipCode(event.target.value)} options={options(geography.zipCodes.isLoading, (geography.zipCodes.data?.items ?? []).map((item) => ({ value: item.code, label: item.code })))} />
      {[geography.countries, geography.states, geography.counties, geography.cities, geography.zipCodes].some((query) => query.isError) && <p className="text-xs text-error">No fue posible cargar uno de los catálogos geográficos.</p>}
      {error && <p role="alert" className="text-xs text-error">{error}</p>}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button loading={create.isPending} onClick={() => void submit()}>Crear y seleccionar</Button>
      </div>
    </div>
  );
};

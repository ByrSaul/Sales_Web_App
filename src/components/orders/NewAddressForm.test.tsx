import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressForm } from '../../features/addresses/addressService';
import type { CustomerAddress } from '../../features/catalogs/types';
import { NewAddressForm } from './NewAddressForm';

type Item = { id: string; code: string; longName: string; name: string; description: string };
type Query = { isLoading: boolean; isError: boolean; data?: { items: Item[] } };
type Geography = Record<'countries' | 'states' | 'counties' | 'cities' | 'zipCodes', Query>;
const mocks = vi.hoisted(() => ({
  geography: vi.fn<(...args: [boolean, string, string, string, string]) => Geography>(),
  mutate: vi.fn<(form: AddressForm) => Promise<CustomerAddress>>(),
  pending: false,
}));
vi.mock('../../features/addresses/addressHooks', () => ({
  useAddressGeography: (...args: [boolean, string, string, string, string]) => mocks.geography(...args),
  useCreateAddress: () => ({ mutateAsync: mocks.mutate, isPending: mocks.pending }),
}));
const address: CustomerAddress = { locationId: 'L', description: 'Casa', formattedAddress: 'Calle 1', countryId: 'GTM', roles: 'Delivery', recId: 1 };
const field = (label: string): HTMLInputElement | HTMLSelectElement => {
  const input = screen.getByText(label, { selector: 'label' }).parentElement?.querySelector('input,select');
  if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) throw new Error('Missing field: ' + label);
  return input;
};
const change = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
let geography: Geography;
const mount = () => {
  const onCreated = vi.fn(); const onCancel = vi.fn();
  return { onCreated, onCancel, ...render(<NewAddressForm customerAccount="C1" onCreated={onCreated} onCancel={onCancel} />) };
};
const fill = () => {
  change('Descripción', ' Casa '); change('Calle', ' Calle 1 ');
  change('País', 'GTM'); change('Estado/departamento', '01'); change('Municipio/condado', '0101'); change('Ciudad', 'GUA'); change('Código postal', '01001');
};
beforeEach(() => {
  vi.resetAllMocks(); mocks.pending = false;
  const query = (id: string): Query => ({ isLoading: false, isError: false, data: { items: [id, id + 'B'].map(code => ({ id: code, code, longName: code, name: code, description: code })) } });
  geography = { countries: query('GTM'), states: query('01'), counties: query('0101'), cities: query('GUA'), zipCodes: query('01001') };
  mocks.geography.mockImplementation(() => geography);
  mocks.mutate.mockResolvedValue(address);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('NewAddressForm', () => {
  it('requires country/description/street/zip before submitting and enables each level in sequence', async () => {
    mount();
    for (const label of ['Estado/departamento', 'Municipio/condado', 'Ciudad', 'Código postal']) expect(field(label)).toBeDisabled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Crear y seleccionar' })));
    expect(screen.getByRole('alert')).toHaveTextContent('Complete descripción, calle, país y código postal.');
    expect(mocks.mutate).not.toHaveBeenCalled();
    change('País', 'GTM'); expect(field('Estado/departamento')).toBeEnabled();
    change('Estado/departamento', '01'); expect(field('Municipio/condado')).toBeEnabled();
    change('Municipio/condado', '0101'); expect(field('Ciudad')).toBeEnabled();
    change('Ciudad', 'GUA'); expect(field('Código postal')).toBeEnabled();
    expect(mocks.geography).toHaveBeenLastCalledWith(true, 'GTM', '01', '0101', 'GUA');
  });
  it('creates the address with the selected hierarchy and passes the returned object to its parent', async () => {
    const view = mount(); fill();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Crear y seleccionar' })));
    expect(mocks.mutate).toHaveBeenCalledExactlyOnceWith({ customerAccount: 'C1', countryId: 'GTM', stateId: '01', countyId: '0101', cityId: 'GUA', zipCode: '01001', description: ' Casa ', street: ' Calle 1 ' });
    expect(view.onCreated).toHaveBeenCalledExactlyOnceWith(address);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it.each([
    ['País', 'GTMB', ['Estado/departamento', 'Municipio/condado', 'Ciudad', 'Código postal']],
    ['Estado/departamento', '01B', ['Municipio/condado', 'Ciudad', 'Código postal']],
    ['Municipio/condado', '0101B', ['Ciudad', 'Código postal']],
    ['Ciudad', 'GUAB', ['Código postal']],
  ])('clears dependent selections when %s changes', (parent, value, descendants) => {
    mount(); fill(); change(parent, value);
    for (const label of descendants) expect(field(label)).toHaveValue('');
    expect(field(parent)).toHaveValue(value);
  });
  it.each([new Error('Address rejected'), 'unstructured error'])('renders creation errors without notifying success (%s)', async (error) => {
    mocks.mutate.mockRejectedValue(error);
    const view = mount(); fill();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Crear y seleccionar' })));
    expect(screen.getByRole('alert')).toHaveTextContent(error instanceof Error ? error.message : 'No fue posible crear la dirección.');
    expect(view.onCreated).not.toHaveBeenCalled();
  });
  it('blocks another submit while the mutation is pending', async () => {
    let release!: (value: CustomerAddress) => void;
    mocks.mutate.mockImplementation(() => { mocks.pending = true; return new Promise(resolve => { release = resolve; }); });
    const view = mount(); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Crear y seleccionar' }));
    view.rerender(<NewAddressForm customerAccount="C1" onCreated={view.onCreated} onCancel={view.onCancel} />);
    expect(screen.getByRole('button', { name: /Crear y seleccionar/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Crear y seleccionar/ }));
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    await act(async () => { mocks.pending = false; release(address); });
    expect(view.onCreated).toHaveBeenCalledTimes(1);
  });
  it('reports any failed catalogue and still allows cancellation', () => {
    geography.states.isError = true;
    const view = mount();
    expect(screen.getByText('No fue posible cargar uno de los catálogos geográficos.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(view.onCancel).toHaveBeenCalledTimes(1);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it('handles absent catalogues and shows the loading option for every level', () => {
    for (const item of Object.values(geography)) { item.isLoading = true; item.data = undefined; }
    mount();
    expect(screen.getAllByRole('option', { name: 'Cargando...' })).toHaveLength(5);
  });
  it('uses the city identifier if its description is missing', () => {
    geography.cities.data!.items[0].description = '';
    mount();
    expect(screen.getByRole('option', { name: 'GUA' })).toHaveValue('GUA');
  });
});

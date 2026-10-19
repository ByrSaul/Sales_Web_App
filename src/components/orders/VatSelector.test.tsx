import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyOperationalContext } from '../../core/session/storage';
import type { DocumentTypes, VatNumber } from '../../features/catalogs/types';
import type { CreateVatInput } from '../../features/catalogs/vatService';
import { VatSelector } from './VatSelector';

type Results = { items: VatNumber[]; isFetching: boolean; isError: boolean; hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => Promise<void> };
type Documents = { data?: DocumentTypes; isLoading: boolean; isError: boolean };
const mocks = vi.hoisted(() => ({
  results: vi.fn<(country: string, search: string, enabled: boolean) => Results>(),
  documents: vi.fn<(country: string, enabled: boolean) => Documents>(),
  create: vi.fn<(input: CreateVatInput) => Promise<VatNumber>>(),
  more: vi.fn<() => Promise<void>>(), pending: false, company: 'CO',
}));
vi.mock('../../app/providers/SessionProvider', () => ({ useSession: () => ({ context: {
  ...emptyOperationalContext('vat-test'),
  company: mocks.company ? { id: mocks.company, name: 'Company', defaultCurrency: 'USD', availableCurrencies: ['USD'] } : null,
} }) }));
vi.mock('../../features/catalogs/vatHooks', () => ({
  useVatNumbers: (country: string, search: string, enabled: boolean) => mocks.results(country, search, enabled),
  useVatDocumentTypes: (country: string, enabled: boolean) => mocks.documents(country, enabled),
  useCreateVat: () => ({ mutateAsync: mocks.create, isPending: mocks.pending }),
}));
const vat: VatNumber = { companyId: 'CO', vatNumber: '123', countryId: 'GTM', name: 'Cliente fiscal', documentType: 'NIT' };
const field = (label: string): HTMLInputElement | HTMLSelectElement => {
  const input = screen.getByText(label, { selector: 'label' }).parentElement?.querySelector('input,select');
  if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) throw new Error('Missing field ' + label);
  return input;
};
const change = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
let results: Results; let documents: Documents;
const mount = (countryId = 'GTM', value: string | null = null) => {
  const onChange = vi.fn();
  return { onChange, ...render(<VatSelector countryId={countryId} value={value} onChange={onChange} />) };
};
const search = (value = '123') => { change('Buscar NIF', value); act(() => { vi.advanceTimersByTime(1000); }); };
const start = () => fireEvent.click(screen.getByRole('button', { name: 'Crear nuevo NIF' }));
const fill = () => { change('NIF', ' 123 '); change('Nombre fiscal', ' Cliente '); change('Tipo de documento', 'NIT'); };
const submit = () => act(async () => fireEvent.click(screen.getByRole('button', { name: /Crear y seleccionar/ })));
beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks(); mocks.pending = false; mocks.company = 'CO';
  mocks.more.mockResolvedValue(undefined); mocks.create.mockResolvedValue(vat);
  results = { items: [], isFetching: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: mocks.more };
  documents = { isLoading: false, isError: false, data: { documentTypes: ['NIT'], felPanama: ['Natural'], felElSalvador: ['Juridica'] } };
  mocks.results.mockImplementation(() => results); mocks.documents.mockImplementation(() => documents);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('VatSelector', () => {
  it('debounces search, selects a VAT and removes a selected value without creating', () => {
    results.items = [vat];
    const view = mount('GTM', 'old');
    expect(mocks.results).toHaveBeenLastCalledWith('GTM', '', false);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(view.onChange).toHaveBeenCalledWith(null);
    change('Buscar NIF', '123');
    expect(screen.queryByRole('button', { name: /Cliente fiscal/ })).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(mocks.results).toHaveBeenLastCalledWith('GTM', '123', true);
    fireEvent.click(screen.getByRole('button', { name: /123.*Cliente fiscal/ }));
    expect(view.onChange).toHaveBeenLastCalledWith('123');
    expect(screen.queryByRole('button', { name: /Cliente fiscal/ })).not.toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each([["loading","Buscando NIF..."],["error","No fue posible consultar NIF."],["empty","No se encontraron NIF."]])('shows the %s query state only after search is applied', (state, expected) => {
    results.isFetching = state === 'loading'; results.isError = state === 'error';
    mount(); search();
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
  it('keeps cached results visible while loading, loads more and disables the button while pending', async () => {
    results.items = [vat]; results.isFetching = true; results.hasNextPage = true;
    const view = mount(); search();
    expect(screen.queryByText('Buscando NIF...')).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cargar más' })));
    expect(mocks.more).toHaveBeenCalledTimes(1);
    results.isFetchingNextPage = true;
    view.rerender(<VatSelector countryId="GTM" value={null} onChange={view.onChange} />);
    expect(screen.getByRole('button', { name: /Cargar más/ })).toBeDisabled();
  });
  it('clears old-country search and does not query whitespace', () => {
    const view = mount(); search('   ');
    expect(mocks.results).toHaveBeenLastCalledWith('GTM', '   ', false);
    search(); view.rerender(<VatSelector countryId="PAN" value={null} onChange={view.onChange} />);
    expect(field('Buscar NIF')).toHaveValue('');
    expect(mocks.results).toHaveBeenLastCalledWith('PAN', '123', false);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(mocks.results).toHaveBeenLastCalledWith('PAN', '', false);
  });
  it('validates required fields before any creation', async () => {
    mount(); start(); await submit();
    expect(screen.getByRole('alert')).toHaveTextContent('Complete los campos obligatorios');
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.documents).toHaveBeenLastCalledWith('GTM', true);
  });
  it.each(['GTM', 'PAN', 'SLV'])('submits country-specific fiscal fields for %s without inventing values for other countries', async (country) => {
    const view = mount(country); start(); fill();
    if (country !== 'GTM') {
      await submit(); expect(mocks.create).not.toHaveBeenCalled();
      change(country === 'PAN' ? 'Tipo de contribuyente' : 'Tipo de persona', country === 'PAN' ? 'Natural' : 'Juridica');
    }
    await submit();
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ company: 'CO', countryId: country, vatNumber: '123', name: 'Cliente', documentType: 'NIT', taxpayerType: country === 'PAN' ? 'Natural' : '', personType: country === 'SLV' ? 'Juridica' : '' });
    expect(view.onChange).toHaveBeenCalledExactlyOnceWith('123');
    expect(field('Buscar NIF')).toHaveValue('123');
    expect(screen.queryByText('Nuevo NIF')).not.toBeInTheDocument();
  });
  it.each([new Error('Rejected fiscal document'), 'invalid response'])('handles creation errors and clears the error on cancel (%s)', async (error) => {
    mocks.create.mockRejectedValue(error);
    const view = mount(); start(); fill(); await submit();
    expect(screen.getByRole('alert')).toHaveTextContent(error instanceof Error ? error.message : 'No fue posible crear el documento fiscal.');
    expect(view.onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' })); start();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('blocks another click while the creation mutation is pending', async () => {
    let release!: (value: VatNumber) => void;
    mocks.create.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const view = mount(); start(); fill(); fireEvent.click(screen.getByRole('button', { name: /Crear y seleccionar/ }));
    mocks.pending = true; view.rerender(<VatSelector countryId="GTM" value={null} onChange={view.onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Crear y seleccionar/ }));
    expect(screen.getByRole('button', { name: /Crear y seleccionar/ })).toBeDisabled();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    await act(async () => { mocks.pending = false; release(vat); });
  });
  it('shows document loading, empty and error states without manufacturing options', () => {
    documents.isLoading = true; documents.data = undefined;
    const view = mount('PAN'); start();
    expect(screen.getByRole('option', { name: 'Cargando...' })).toBeInTheDocument();
    expect(field('Tipo de contribuyente').children).toHaveLength(1);
    documents.isLoading = false; documents.data = { documentTypes: [], felPanama: [], felElSalvador: [] };
    view.rerender(<VatSelector countryId="SLV" value={null} onChange={view.onChange} />);
    expect(screen.getByText('No hay tipos de documento disponibles para este país.')).toBeInTheDocument();
    expect(field('Tipo de persona').children).toHaveLength(1);
    documents.isError = true;
    view.rerender(<VatSelector countryId="SLV" value={null} onChange={view.onChange} />);
    expect(screen.getByText('No fue posible cargar los tipos de documento.')).toBeInTheDocument();
    expect(screen.queryByText('No hay tipos de documento disponibles para este país.')).not.toBeInTheDocument();
  });
  it('retains the existing empty-company contract when no company is present', async () => {
    mocks.company = '';
    mount(); start(); fill(); await submit();
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ company: '' }));
  });
});

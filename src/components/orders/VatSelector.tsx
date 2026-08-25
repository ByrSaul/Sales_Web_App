import { useEffect, useState } from 'react';
import { useSession } from '../../app/providers/SessionProvider';
import { useDebouncedValue } from '../../core/hooks/useDebouncedValue';
import { useCreateVat, useVatDocumentTypes, useVatNumbers } from '../../features/catalogs/vatHooks';
import { Button, Input, Select } from '../ui';

type Props = { countryId: string; value: string | null; onChange: (value: string | null) => void };

/** Selector y formulario de creación de NIF/VAT para el país de la dirección. */
export const VatSelector = ({ countryId, value, onChange }: Props) => {
  const { context } = useSession();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [vatNumber, setVatNumber] = useState('');
  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [taxpayerType, setTaxpayerType] = useState('');
  const [personType, setPersonType] = useState('');
  const [error, setError] = useState('');
  const [showResults, setShowResults] = useState(false);
  const debounced = useDebouncedValue(search, 1000);
  const applied = Boolean(debounced.trim() && debounced.trim() === search.trim());
  const results = useVatNumbers(countryId, debounced, applied && !creating);
  const documents = useVatDocumentTypes(countryId, creating);
  const create = useCreateVat();
  useEffect(() => {
    setSearch('');
    setShowResults(false);
  }, [countryId]);

  const submit = async () => {
    if (!vatNumber.trim() || !name.trim() || !documentType || (countryId === 'PAN' && !taxpayerType) || (countryId === 'SLV' && !personType)) {
      setError('Complete los campos obligatorios del documento fiscal.');
      return;
    }
    setError('');
    try {
      const result = await create.mutateAsync({ company: context.company?.id ?? '', countryId, vatNumber: vatNumber.trim(), name: name.trim(), documentType, taxpayerType: countryId === 'PAN' ? taxpayerType : '', personType: countryId === 'SLV' ? personType : '' });
      onChange(result.vatNumber);
      setCreating(false);
      setSearch(result.vatNumber);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible crear el documento fiscal.');
    }
  };

  if (creating) return (
    <div className="space-y-3 rounded-lg border border-outline-variant p-3">
      <h3 className="text-sm font-bold">Nuevo NIF</h3>
      <Input label="NIF" value={vatNumber} onChange={(event) => setVatNumber(event.target.value)} />
      <Input label="Nombre fiscal" value={name} onChange={(event) => setName(event.target.value)} />
      {(documents.isLoading || (documents.data?.documentTypes.length ?? 0) > 0) && <Select label="Tipo de documento" value={documentType} onChange={(event) => setDocumentType(event.target.value)} options={[{ value: '', label: documents.isLoading ? 'Cargando...' : 'Seleccione...' }, ...(documents.data?.documentTypes ?? []).map((item) => ({ value: item, label: item }))]} />}
      {!documents.isLoading && !documents.isError && documents.data?.documentTypes.length === 0 && <p className="text-xs text-on-surface-variant">No hay tipos de documento disponibles para este país.</p>}
      {countryId === 'PAN' && <Select label="Tipo de contribuyente" value={taxpayerType} onChange={(event) => setTaxpayerType(event.target.value)} options={[{ value: '', label: 'Seleccione...' }, ...(documents.data?.felPanama ?? []).map((item) => ({ value: item, label: item }))]} />}
      {countryId === 'SLV' && <Select label="Tipo de persona" value={personType} onChange={(event) => setPersonType(event.target.value)} options={[{ value: '', label: 'Seleccione...' }, ...(documents.data?.felElSalvador ?? []).map((item) => ({ value: item, label: item }))]} />}
      {documents.isError && <p className="text-xs text-error">No fue posible cargar los tipos de documento.</p>}
      {error && <p role="alert" className="text-xs text-error">{error}</p>}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => { setCreating(false); setError(''); }}>Cancelar</Button>
        <Button loading={create.isPending} onClick={() => void submit()}>Crear y seleccionar</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <Input label="Buscar NIF" value={search} onChange={(event) => { setSearch(event.target.value); setShowResults(Boolean(event.target.value.trim())); }} />
      {value && <p className="rounded-lg bg-primary/5 p-2 text-xs">Seleccionado: <strong>{value}</strong> <button type="button" className="ml-2 underline" onClick={() => onChange(null)}>Quitar</button></p>}
      {applied && showResults && results.isFetching && results.items.length === 0 && <p className="text-xs text-on-surface-variant">Buscando NIF...</p>}
      {applied && showResults && results.isError && <p className="text-xs text-error">No fue posible consultar NIF.</p>}
      {applied && showResults && !results.isFetching && !results.isError && results.items.length === 0 && <p className="text-xs text-on-surface-variant">No se encontraron NIF.</p>}
      {applied && showResults && results.items.length > 0 && <div className="max-h-48 space-y-1 overflow-x-hidden overflow-y-auto rounded-lg border border-outline-variant p-1">{results.items.map((item) => <button type="button" key={`${item.countryId}-${item.vatNumber}`} className="block w-full rounded-md p-1.5 text-left text-xs hover:bg-surface-container" onClick={() => { onChange(item.vatNumber); setShowResults(false); }}><strong>{item.vatNumber}</strong><span className="line-clamp-2 block text-on-surface-variant">{item.name}</span></button>)}</div>}
      <div className="flex flex-wrap gap-2">
        {applied && showResults && results.hasNextPage && <Button size="sm" variant="outline" loading={results.isFetchingNextPage} onClick={() => void results.fetchNextPage()}>Cargar más</Button>}
        <Button size="sm" variant="outline" onClick={() => setCreating(true)}>Crear nuevo NIF</Button>
      </div>
    </div>
  );
};

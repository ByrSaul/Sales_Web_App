import { useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedValue } from '../../core/hooks/useDebouncedValue';
import { useCustomerAddresses } from '../../features/catalogs/hooks';
import type { CustomerAddress } from '../../features/catalogs/types';
import { Button, Input } from '../ui';

type Props = {
  customerAccount: string;
  selected: CustomerAddress | null;
  onSelect: (address: CustomerAddress | null) => void;
};

export const CustomerAddressSelector = ({ customerAccount, selected, onSelect }: Props) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebouncedValue(search, 1000);
  const query = useCustomerAddresses(customerAccount);

  useEffect(() => {
    setSearch(selected ? selected.description || selected.formattedAddress : '');
    setOpen(false);
  }, [customerAccount, selected]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const results = useMemo(() => {
    const normalized = debouncedSearch.trim().toLocaleLowerCase();
    if (!normalized) return query.data ?? [];
    return (query.data ?? []).filter((address) =>
      [address.description, address.formattedAddress, address.countryId].some((value) =>
        value.toLocaleLowerCase().includes(normalized),
      ),
    );
  }, [debouncedSearch, query.data]);
  const debouncePending = search.trim() !== debouncedSearch.trim();

  return (
    <div ref={root} className="relative w-full max-w-full" onKeyDown={(event) => {
      if (event.key === 'Escape') setOpen(false);
    }}>
      <Input
        label="Dirección existente"
        placeholder="Buscar dirección..."
        disabled={!customerAccount}
        value={search}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setSearch(event.target.value);
          setOpen(true);
        }}
      />
      {open && customerAccount && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 w-full max-w-full overflow-x-hidden overflow-y-auto rounded-lg border border-outline-variant bg-surface p-2 shadow-lg">
          {query.isFetching && !query.data && (
            <p className="p-2 text-xs text-on-surface-variant">Buscando direcciones...</p>
          )}
          {query.isError && (
            <p className="p-2 text-xs text-error">
              No fue posible consultar las direcciones.{' '}
              <button className="underline" onClick={() => void query.refetch()}>Reintentar</button>
            </p>
          )}
          {!debouncePending && !query.isFetching && !query.isError && results.length === 0 && (
            <p className="p-2 text-xs text-on-surface-variant">No se encontraron direcciones.</p>
          )}
          {!debouncePending && results.map((address) => (
            <button
              type="button"
              key={address.locationId}
              className="block w-full max-w-full rounded-md p-2 text-left hover:bg-surface-container"
              onClick={() => {
                onSelect(address);
                setSearch(address.description || address.formattedAddress);
                setOpen(false);
              }}
            >
              <strong className="block break-words text-sm">{address.description || 'Sin descripción'}</strong>
              <span className="line-clamp-3 block break-words text-xs text-on-surface-variant">{address.formattedAddress}</span>
            </button>
          ))}
          {debouncePending && <p className="p-2 text-xs text-on-surface-variant">Escribiendo...</p>}
        </div>
      )}
      {selected && (
        <div className="mt-2 flex items-start justify-between gap-2 rounded-lg bg-primary/5 p-2 text-xs">
          <span className="min-w-0 break-words">{selected.description} · {selected.formattedAddress}</span>
          <Button size="sm" variant="ghost" onClick={() => { onSelect(null); setSearch(''); setOpen(true); }}>Cambiar</Button>
        </div>
      )}
    </div>
  );
};

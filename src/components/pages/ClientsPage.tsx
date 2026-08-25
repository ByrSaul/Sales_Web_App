import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { useDebouncedValue } from '../../core/hooks/useDebouncedValue';
import type { Customer } from '../../features/catalogs/types';
import {
  useCustomerAddresses,
  useCustomers,
} from '../../features/catalogs/hooks';
import { catalogKeys } from '../../features/catalogs/queryKeys';
import { NewAddressForm } from '../orders/NewAddressForm';
import { VatSelector } from '../orders/VatSelector';
import { Badge, Button, Card, EmptyState, Icon, Input, Select } from '../ui';
import { ErrorState, LoadingState } from '../ui/PageState';

/**
 * Drawer con la información comercial, direcciones y acciones del cliente seleccionado.
 *
 * Dependencias:
 * - Contexto de sesión.
 * - TanStack Query.
 * - Catálogos de direcciones y NIF/VAT.
 */
const CustomerDetail = ({
  customer,
  close,
  onStatement,
}: {
  customer: Customer;
  close: () => void;
  onStatement: () => void;
}) => {
  const queryClient = useQueryClient();
  const { context } = useSession();
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [nifAddressLocationId, setNifAddressLocationId] = useState('');
  const [selectedNif, setSelectedNif] = useState<string | null>(null);
  const addresses = useCustomerAddresses(customer.account);
  const showNif = customer.account.trim().toUpperCase() === 'MOST-000001';
  const nifAddress = addresses.data?.find(
    (address) => address.locationId === nifAddressLocationId,
  );

  useEffect(() => {
    setShowNewAddress(false);
    setNifAddressLocationId('');
    setSelectedNif(null);
  }, [customer.account]);

  const addressQueryKey = catalogKeys.addresses(context.company?.id ?? '', customer.account);

  return (
    <aside className="fixed inset-y-0 right-0 z-[60] flex h-screen h-dvh w-full flex-col overflow-hidden bg-white shadow-2xl md:w-[32rem]">
      <div className="flex shrink-0 items-start justify-between border-b border-outline-variant bg-white p-5">
        <div>
          <h2 className="font-bold">{customer.name}</h2>
          <p className="text-xs text-on-surface-variant">{customer.account}</p>
        </div>
        <button aria-label="Cerrar detalle del cliente" onClick={close}>
          <Icon name="close" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-5">
      <div className="grid grid-cols-2 gap-3 my-5 text-xs">
        <Card className="p-3">
          <span className="text-on-surface-variant">Crédito disponible</span>
          <strong className="block text-lg">USD {customer.creditAvailableUsd.toFixed(2)}</strong>
        </Card>
        <Card className="p-3">
          <span className="text-on-surface-variant">Condición</span>
          <strong className="block mt-1">{customer.paymentTerms || 'N/A'}</strong>
        </Card>
      </div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Direcciones</h3>
        <Button variant="outline" onClick={() => setShowNewAddress(true)}>
          Nueva dirección
        </Button>
      </div>
      {showNewAddress && (
        <div className="mb-3 min-w-0">
          <NewAddressForm
            customerAccount={customer.account}
            onCancel={() => setShowNewAddress(false)}
            onCreated={() => {
              setShowNewAddress(false);
              void queryClient.invalidateQueries({ queryKey: addressQueryKey });
            }}
          />
        </div>
      )}
      {addresses.isPending ? (
        <LoadingState message="Cargando direcciones..." />
      ) : addresses.isError ? (
        <ErrorState
          message="No fue posible cargar las direcciones."
          onRetry={() => void addresses.refetch()}
        />
      ) : addresses.data?.length ? (
        <div className="max-h-64 space-y-2 overflow-x-hidden overflow-y-auto pr-1">
          {addresses.data.map((x) => (
            <Card key={x.recId} className="min-w-0 p-3">
              <strong className="block break-words text-sm">{x.description}</strong>
              <p className="mt-1 break-words text-xs">{x.formattedAddress}</p>
              <p className="mt-1 break-words text-[11px] text-on-surface-variant">
                {x.roles} · {x.countryId} · {x.locationId}
              </p>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Sin direcciones" />
      )}
      {showNif && (
        <section className="mt-5 min-w-0 space-y-3 border-t border-outline-variant pt-4">
          <h3 className="text-sm font-semibold">NIF</h3>
          <Select
            label="Dirección para NIF"
            value={nifAddressLocationId}
            onChange={(event) => {
              setNifAddressLocationId(event.target.value);
              setSelectedNif(null);
            }}
            options={[
              { value: '', label: 'Seleccione una dirección...' },
              ...(addresses.data ?? [])
                .filter((address) => Boolean(address.countryId && address.locationId))
                .map((address) => ({
                  value: address.locationId,
                  label: `${address.description || address.formattedAddress} · ${address.countryId}`,
                })),
            ]}
          />
          {nifAddress ? (
            <VatSelector
              countryId={nifAddress.countryId}
              value={selectedNif}
              onChange={setSelectedNif}
            />
          ) : (
            <p className="text-xs text-on-surface-variant">
              Seleccione una dirección para consultar o crear NIF del país correspondiente.
            </p>
          )}
        </section>
      )}
      <Button className="mt-4" onClick={onStatement}>
        Estado de cuenta
      </Button>
      </div>
    </aside>
  );
};

/**
 * Pantalla principal de consulta de clientes asignados al vendedor activo.
 *
 * Responsabilidades:
 * - Buscar y paginar clientes.
 * - Mantener el cliente seleccionado y su estado visual de enfoque.
 * - Mostrar el drawer de detalle.
 * - Navegar al estado de cuenta conservando la cuenta seleccionada.
 *
 * Dependencias:
 * - TanStack Query.
 * - `useCustomers`.
 * - `CustomerDetail`.
 */
const ClientsPage: React.FC<{ onEstadoCuenta?: (customerAccount: string) => void }> = ({
  onEstadoCuenta = () => undefined,
}) => {
  const [params, setParams] = useSearchParams();
  const rawSearch = params.get('search') ?? '';
  const page = Number(params.get('page') ?? 1);
  const [search, setSearch] = useState(rawSearch);
  const debounced = useDebouncedValue(search);
  const [selected, setSelected] = useState<Customer | null>(null);
  const query = useCustomers(debounced, page);
  const update = (nextSearch: string, nextPage = 1) =>
    setParams({ ...(nextSearch ? { search: nextSearch } : {}), page: String(nextPage) });
  const changePage = (nextPage: number) => {
    if (!query.data) return;
    const boundedPage = Math.min(Math.max(nextPage, 1), query.data.pagination.totalPages);
    if (boundedPage === query.data.pagination.currentPage) return;
    setSelected(null);
    update(debounced, boundedPage);
  };
  React.useEffect(() => {
    update(debounced, 1);
  }, [debounced]);
  return (
    <div className="relative space-y-4">
      <div className="flex flex-col md:flex-row justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Mis clientes</h1>
          <p className="text-xs text-on-surface-variant">Clientes asignados al vendedor activo</p>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon="search"
          placeholder="Cuenta o nombre..."
          className="md:w-80"
        />
      </div>
      {!debounced.trim() ? (
        <EmptyState icon="search" title="Escriba una cuenta o nombre para buscar clientes" />
      ) : query.isPending ? (
        <p className="text-xs text-on-surface-variant">Buscando clientes...</p>
      ) : query.isError ? (
        <ErrorState
          message="No fue posible cargar los clientes."
          onRetry={() => void query.refetch()}
        />
      ) : !query.data || query.data.items.length === 0 ? (
        <EmptyState icon="group" title="No se encontraron clientes" />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {query.data.items.map((customer) => {
              const isSelected =
                selected?.companyId === customer.companyId &&
                selected.account === customer.account;

              return (
                <Card
                  key={`${customer.companyId}-${customer.account}`}
                  hover
                  onClick={() => setSelected(customer)}
                  className={`p-4 transition-[opacity,filter,box-shadow,border-color] duration-200 ${
                    selected
                      ? isSelected
                        ? 'opacity-100 md:relative md:z-20 md:border-primary md:shadow-lg md:ring-1 md:ring-primary/20'
                        : 'opacity-50 blur-[1px]'
                      : ''
                  }`}
                >
                  <div className="flex justify-between">
                    <div>
                      <strong className="text-sm">{customer.name}</strong>
                      <p className="text-xs text-on-surface-variant">
                        {customer.account} · {customer.currency}
                      </p>
                    </div>
                    <Badge
                      label={customer.blocked !== 0 ? 'BLOQUEADO' : 'ACTIVO'}
                      variant={customer.blocked !== 0 ? 'blocked' : 'success'}
                    />
                  </div>
                  <div className="flex justify-between mt-3 text-xs">
                    <span>Crédito disponible</span>
                    <strong>USD {customer.creditAvailableUsd.toFixed(2)}</strong>
                  </div>
                </Card>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>{query.data.pagination.totalRecords} registros</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={query.data.pagination.currentPage <= 1}
                onClick={() => changePage(query.data.pagination.currentPage - 1)}
              >
                Anterior
              </Button>
              <span className="whitespace-nowrap p-2">
                Página {query.data.pagination.currentPage} de{' '}
                {query.data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={
                  query.data.pagination.currentPage >= query.data.pagination.totalPages
                }
                onClick={() => changePage(query.data.pagination.currentPage + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
      {selected && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 bg-white/40 backdrop-blur-[1px] transition-opacity duration-200"
        />
      )}
      {selected && (
        <CustomerDetail
          customer={selected}
          close={() => setSelected(null)}
          onStatement={() => onEstadoCuenta(selected.account)}
        />
      )}
    </div>
  );
};
export default ClientsPage;

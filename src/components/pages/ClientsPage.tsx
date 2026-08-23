import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedValue } from '../../core/hooks/useDebouncedValue';
import type { Customer } from '../../features/catalogs/types';
import {
  useCustomerAddresses,
  useCustomers,
  useReferenceCatalogs,
} from '../../features/catalogs/hooks';
import { Badge, Button, Card, EmptyState, Icon, Input } from '../ui';
import { ErrorState, LoadingState } from '../ui/PageState';

const CustomerDetail = ({
  customer,
  close,
  onStatement,
}: {
  customer: Customer;
  close: () => void;
  onStatement: () => void;
}) => {
  const addresses = useCustomerAddresses(customer.account);
  const catalogs = useReferenceCatalogs(customer.account, customer.countryId);
  return (
    <aside className="fixed inset-y-0 right-0 w-full md:w-[32rem] bg-white shadow-2xl z-50 overflow-y-auto p-5">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="font-bold">{customer.name}</h2>
          <p className="text-xs text-on-surface-variant">{customer.account}</p>
        </div>
        <button onClick={close}>
          <Icon name="close" />
        </button>
      </div>
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
      <h3 className="font-semibold text-sm mb-2">Direcciones</h3>
      {addresses.isPending ? (
        <LoadingState message="Cargando direcciones..." />
      ) : addresses.isError ? (
        <ErrorState
          message="No fue posible cargar las direcciones."
          onRetry={() => void addresses.refetch()}
        />
      ) : addresses.data?.length ? (
        <div className="space-y-2">
          {addresses.data.map((x) => (
            <Card key={x.recId} className="p-3">
              <strong className="text-sm">{x.description}</strong>
              <p className="text-xs mt-1">{x.formattedAddress}</p>
              <p className="text-[11px] text-on-surface-variant mt-1">
                {x.roles} · {x.countryId} · {x.locationId}
              </p>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Sin direcciones" />
      )}
      <div className="mt-5 text-xs text-on-surface-variant">
        Acuerdos disponibles: {catalogs.agreements.data?.items.length ?? 0} · Tipos de documento:{' '}
        {catalogs.documents.data?.documentTypes.length ?? 0}
      </div>
      <Button className="mt-4" onClick={onStatement}>
        Estado de cuenta
      </Button>
    </aside>
  );
};

const ClientsPage: React.FC<{ onEstadoCuenta?: () => void }> = ({
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
  React.useEffect(() => {
    update(debounced, 1);
  }, [debounced]);
  if (query.isPending) return <LoadingState message="Cargando clientes..." />;
  return (
    <div className="space-y-4">
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
      {query.isError ? (
        <ErrorState
          message="No fue posible cargar los clientes."
          onRetry={() => void query.refetch()}
        />
      ) : query.data.items.length === 0 ? (
        <EmptyState icon="group" title="No se encontraron clientes" />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {query.data.items.map((customer) => (
              <Card
                key={`${customer.companyId}-${customer.account}`}
                hover
                onClick={() => setSelected(customer)}
                className="p-4"
              >
                <div className="flex justify-between">
                  <div>
                    <strong className="text-sm">{customer.name}</strong>
                    <p className="text-xs text-on-surface-variant">
                      {customer.account} · {customer.currency}
                    </p>
                  </div>
                  <Badge
                    label={customer.blocked ? 'BLOQUEADO' : 'ACTIVO'}
                    variant={customer.blocked ? 'blocked' : 'success'}
                  />
                </div>
                <div className="flex justify-between mt-3 text-xs">
                  <span>Crédito disponible</span>
                  <strong>USD {customer.creditAvailableUsd.toFixed(2)}</strong>
                </div>
              </Card>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>{query.data.pagination.totalRecords} registros</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => update(debounced, page - 1)}
              >
                Anterior
              </Button>
              <span className="p-2">
                {page} / {Math.max(1, query.data.pagination.totalPages)}
              </span>
              <Button
                variant="outline"
                disabled={page >= query.data.pagination.totalPages}
                onClick={() => update(debounced, page + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
      {selected && (
        <CustomerDetail
          customer={selected}
          close={() => setSelected(null)}
          onStatement={onEstadoCuenta}
        />
      )}
    </div>
  );
};
export default ClientsPage;

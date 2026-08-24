import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebouncedValue } from '../../core/hooks/useDebouncedValue';
import { useSession } from '../../app/providers/SessionProvider';
import {
  useCustomerAddresses,
  useInfiniteCustomers,
  useReferenceCatalogs,
} from '../../features/catalogs/hooks';
import type { Customer } from '../../features/catalogs/types';
import { isFullyBlockedCustomer } from '../../features/catalogs/customerRules';
import { useOrderDraft } from '../../features/orderDraft/OrderDraftProvider';
import { Button, Card, Input, Select } from '../ui';
import { ErrorState } from '../ui/PageState';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const CreateOrderPage = () => {
  const navigate = useNavigate();
  const { context } = useSession();
  const { draft, update } = useOrderDraft();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 1000);
  const customers = useInfiniteCustomers(debouncedSearch);
  const isCustomerSearchApplied =
    debouncedSearch.trim().length >= 1 && debouncedSearch.trim() === search.trim();
  const addresses = useCustomerAddresses(draft.customer?.account ?? '');
  const refs = useReferenceCatalogs(draft.customer?.account ?? '', '', {
    promotions: false,
    documents: false,
  });
  const currencies = context.company?.availableCurrencies ?? [];
  useEffect(() => {
    if (!draft.customer) return;
    const languageId =
      context.user?.language && context.user.language.length > 0
        ? context.user.language
        : draft.customer.languageId;
    if (draft.languageId !== languageId) update({ languageId });
  }, [context.user?.language, draft.customer, draft.languageId, update]);
  const chooseCustomer = (customer: Customer) => {
    if (isFullyBlockedCustomer(customer)) return;
    if (draft.customer?.account === customer.account) return;
    if (
      draft.lines.length &&
      !window.confirm(
        'Cambiar cliente eliminará las líneas y datos comerciales dependientes. ¿Continuar?',
      )
    )
      return;
    update({
      customer,
      languageId:
        context.user?.language && context.user.language.length > 0
          ? context.user.language
          : customer.languageId,
      currencyCode: currencies.includes(customer.currency) ? customer.currency : draft.currencyCode,
      deliveryAddress: null,
      agreement: null,
      taxExemptNumber: null,
      lines: [],
    });
    setSearch(`${customer.account} - ${customer.name}`);
  };
  const changeCurrency = (currencyCode: string) => {
    if (currencyCode === draft.currencyCode) return;
    if (
      draft.lines.length &&
      !window.confirm(
        'Cambiar moneda eliminará las líneas cuyos precios ya no son válidos. ¿Continuar?',
      )
    )
      return;
    update({ currencyCode, lines: [] });
  };
  const ready = Boolean(
    draft.customer &&
    draft.deliveryMode &&
    draft.deliveryAddress &&
    draft.requestedShippingDate &&
    draft.languageId.length > 0 &&
    currencies.includes(draft.currencyCode),
  );
  return (
    <div className="space-y-4 pb-12">
      <div>
        <h1 className="text-xl font-bold">Encabezado del pedido</h1>
        <p className="text-xs text-on-surface-variant">Borrador local · {draft.id}</p>
      </div>
      <Card className="p-4 space-y-3">
        <h2 className="font-bold text-sm">Cliente</h2>
        <Input
          label="Buscar por cuenta o nombre"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon="search"
        />
        {!draft.customer && isCustomerSearchApplied && customers.isFetching && !customers.isFetchingNextPage && customers.items.length === 0 && (
          <p className="text-xs text-on-surface-variant">Buscando clientes...</p>
        )}
        {!draft.customer && isCustomerSearchApplied && customers.isError && (
          <p className="text-xs text-error">
            No fue posible consultar clientes.{' '}
            <button className="underline" onClick={() => void customers.refetch()}>Reintentar</button>
          </p>
        )}
        {isCustomerSearchApplied && !customers.isError && !draft.customer && customers.items.length > 0 && (
          <div className="max-h-80 w-full max-w-full space-y-2 overflow-x-hidden overflow-y-auto rounded-lg border p-2">
            {customers.items.map((customer) => {
              const fullyBlocked = isFullyBlockedCustomer(customer);
              return (
              <button
                type="button"
                key={`${customer.companyId}-${customer.account}`}
                disabled={fullyBlocked}
                aria-label={`${customer.name}, cuenta ${customer.account}${fullyBlocked ? ', bloqueado para todas las transacciones' : ''}`}
                onClick={() => chooseCustomer(customer)}
                className={`block w-full rounded-lg border p-3 text-left ${fullyBlocked ? 'cursor-not-allowed border-error/40 bg-error/5 opacity-70' : 'border-outline-variant hover:bg-surface-container'}`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <strong className="block text-sm">{customer.name}</strong>
                    <span className="text-xs text-on-surface-variant">{customer.account}</span>
                  </span>
                  {fullyBlocked && (
                    <span className="text-right">
                      <span className="rounded-full border border-error/30 bg-error/10 px-2 py-0.5 text-xs font-semibold text-error">Bloqueado</span>
                      <span className="mt-1 block text-xs text-error">Tipo de bloqueo: {customer.blockedDescription}</span>
                    </span>
                  )}
                </span>
                <span className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                  <span><span className="block text-on-surface-variant">Crédito disponible</span><strong>{usd.format(customer.creditAvailableUsd)}</strong></span>
                  <span><span className="block text-on-surface-variant">Términos</span><strong>{customer.paymentTerms || '—'}</strong></span>
                  <span><span className="block text-on-surface-variant">Moneda</span><strong>{customer.currency || '—'}</strong></span>
                </span>
              </button>
              );
            })}
            {customers.hasNextPage && (
              <Button
                fullWidth
                size="sm"
                variant="outline"
                loading={customers.isFetchingNextPage}
                onClick={() => void customers.fetchNextPage()}
              >
                Cargar más clientes
              </Button>
            )}
          </div>
        )}
        {isCustomerSearchApplied && !customers.isFetching && !customers.isError && !draft.customer && customers.items.length === 0 && (
          <p className="text-xs text-on-surface-variant">No se encontraron clientes.</p>
        )}
        {draft.customer && (
          <div className="p-3 bg-primary/5 rounded-lg flex justify-between gap-3">
            <div>
              <strong>
                {draft.customer.account} · {draft.customer.name}
              </strong>
              <p className="text-xs">
                Crédito disponible USD: {draft.customer.creditAvailableUsd.toFixed(2)} ·{' '}
                {draft.customer.blockedDescription}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch('');
                update({
                  customer: null,
                  deliveryAddress: null,
                  agreement: null,
                  taxExemptNumber: null,
                  lines: [],
                });
              }}
            >
              Cambiar
            </Button>
          </div>
        )}
      </Card>
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <h2 className="font-bold text-sm">Entrega y condiciones</h2>
          <Select
            label="Moneda"
            value={draft.currencyCode}
            onChange={(e) => changeCurrency(e.target.value)}
            options={[
              { value: '', label: 'Seleccione...' },
              ...currencies.map((value) => ({ value, label: value })),
            ]}
          />
          <Select
            label="Modo de entrega"
            value={draft.deliveryMode?.code ?? ''}
            onChange={(e) =>
              update({
                deliveryMode: refs.delivery.data?.find((x) => x.code === e.target.value) ?? null,
              })
            }
            options={[
              { value: '', label: refs.delivery.isLoading ? 'Cargando...' : 'Seleccione...' },
              ...(refs.delivery.data ?? []).map((x) => ({
                value: x.code,
                label: `${x.code} · ${x.description}`,
              })),
            ]}
          />
          <Select
            label="Dirección existente"
            disabled={!draft.customer || addresses.isLoading}
            value={draft.deliveryAddress?.locationId ?? ''}
            onChange={(e) =>
              update({
                deliveryAddress:
                  addresses.data?.find((x) => x.locationId === e.target.value) ?? null,
              })
            }
            options={[
              { value: '', label: addresses.isLoading ? 'Cargando...' : 'Seleccione...' },
              ...(addresses.data ?? []).map((x) => ({
                value: x.locationId,
                label: `${x.description} · ${x.formattedAddress}`,
              })),
            ]}
          />
          {addresses.isError && (
            <ErrorState
              message="No se pudieron cargar las direcciones."
              onRetry={() => addresses.refetch()}
            />
          )}
          <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
            No es posible crear una nueva dirección: países, estados, municipios, ciudades y ZIP
            todavía requieren GET con JSON body, sin alternativa Web compatible.
          </p>
          <Input
            label="Fecha solicitada de envío"
            type="date"
            value={draft.requestedShippingDate}
            onChange={(e) => update({ requestedShippingDate: e.target.value })}
          />
        </Card>
        <Card className="p-4 space-y-3">
          <h2 className="font-bold text-sm">Datos comerciales</h2>
          <Select
            label="Origen de venta"
            value={draft.salesOrigin?.id ?? ''}
            onChange={(e) =>
              update({
                salesOrigin: refs.origins.data?.find((x) => x.id === e.target.value) ?? null,
              })
            }
            options={[
              { value: '', label: refs.origins.isLoading ? 'Cargando...' : 'Sin origen' },
              ...(refs.origins.data ?? []).map((x) => ({
                value: x.id,
                label: `${x.id} · ${x.description}`,
              })),
            ]}
          />
          <Select
            label="Acuerdo comercial (opcional)"
            disabled={!draft.customer || refs.agreements.isLoading}
            value={draft.agreement?.recId ?? ''}
            onChange={(e) => {
              const a = refs.agreements.data?.items.find((x) => String(x.recId) === e.target.value);
              update({
                agreement: a
                  ? { recId: a.recId, number: a.number, title: a.title, currency: a.currency }
                  : null,
              });
            }}
            options={[
              { value: '', label: 'Sin acuerdo' },
              ...(refs.agreements.data?.items ?? []).map((x) => ({
                value: String(x.recId),
                label: `${x.number} · ${x.title}`,
              })),
            ]}
          />
          <Input
            label="Referencia del cliente"
            value={draft.customerReference}
            onChange={(e) => update({ customerReference: e.target.value })}
          />
          <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
            Observaciones
            <textarea
              rows={4}
              maxLength={1000}
              value={draft.observations}
              onChange={(e) => update({ observations: e.target.value })}
              className="p-3 rounded-lg border border-outline-variant text-sm text-on-surface"
            />
          </label>
          <div className="text-xs bg-surface-container p-2 rounded">
            NIT/documento no disponible: la búsqueda en /d365/vat_num y los tipos de
            /d365/vat_num/document_type todavía requieren GET con JSON body. La creación POST no
            se habilita sin esos datos y no se generarán valores ficticios.
          </div>
        </Card>
      </div>
      {!ready && (
        <p role="alert" className="text-sm text-error">
          {draft.customer && !draft.languageId
            ? 'No se pudo determinar LanguageId del usuario ni del cliente seleccionado.'
            : 'Complete cliente, moneda, entrega, dirección y fecha para continuar.'}
        </p>
      )}
      <Button size="lg" fullWidth disabled={!ready} onClick={() => navigate('/crear-pedido/linea')}>
        Continuar a líneas
      </Button>
    </div>
  );
};
export default CreateOrderPage;

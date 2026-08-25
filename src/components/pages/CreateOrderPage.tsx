import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebouncedValue } from '../../core/hooks/useDebouncedValue';
import { useSession } from '../../app/providers/SessionProvider';
import {
  useInfiniteCustomers,
  useReferenceCatalogs,
} from '../../features/catalogs/hooks';
import type { Customer } from '../../features/catalogs/types';
import { isFullyBlockedCustomer } from '../../features/catalogs/customerRules';
import { useOrderDraft } from '../../features/orderDraft/OrderDraftProvider';
import { Button, Card, Input, Select } from '../ui';
import { NewAddressForm } from '../orders/NewAddressForm';
import { VatSelector } from '../orders/VatSelector';
import { DraftAttachments } from '../orders/DraftAttachments';
import { CustomerAddressSelector } from '../orders/CustomerAddressSelector';
import { hasValidLocalPaymentAttachment, requiresPaymentAttachment } from '../../features/attachments/attachmentValidation';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/**
 * Pantalla de captura del encabezado de un nuevo pedido.
 *
 * Flujo:
 * - Selecciona cliente, dirección y condiciones comerciales.
 * - Conserva los datos en `OrderDraftProvider`.
 * - Valida requisitos antes de continuar a las líneas.
 *
 * Dependencias:
 * - Contexto de sesión.
 * - Borrador de pedido.
 * - Catálogos comerciales y adjuntos.
 */
const CreateOrderPage = () => {
  const navigate = useNavigate();
  const { context } = useSession();
  const { draft, attachments, update } = useOrderDraft();
  const [search, setSearch] = useState('');
  const [showNewAddress, setShowNewAddress] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 1000);
  const customers = useInfiniteCustomers(debouncedSearch);
  const isCustomerSearchApplied =
    debouncedSearch.trim().length >= 1 && debouncedSearch.trim() === search.trim();
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
  const showNif = draft.customer?.account.trim().toUpperCase() === 'MOST-000001';
  const paymentRequired = requiresPaymentAttachment(draft.customer?.account);
  const hasLocalPayment = hasValidLocalPaymentAttachment(attachments);
  const hasCustomer = Boolean(draft.customer);
  const hasCurrency = currencies.includes(draft.currencyCode);
  const hasDeliveryMode = Boolean(draft.deliveryMode?.code.trim());
  const hasDeliveryAddress = Boolean(draft.deliveryAddress?.locationId.trim());
  const hasRequestedDate = Boolean(draft.requestedShippingDate.trim());
  const hasLanguage = Boolean(draft.languageId.trim());
  const hasRequiredFiscalData = !showNif || Boolean(draft.taxExemptNumber?.trim());
  const hasRequiredPaymentAttachment = !paymentRequired || hasLocalPayment;
  const ready = hasCustomer && hasCurrency && hasDeliveryMode && hasDeliveryAddress && hasRequestedDate && hasLanguage && hasRequiredFiscalData && hasRequiredPaymentAttachment;
  const hasPreparedImage = attachments.some((item) => ['jpg', 'jpeg', 'png'].includes(item.extension));
  const missingMessages = [
    !hasCustomer && 'Seleccione un cliente.',
    !hasCurrency && 'Seleccione una moneda válida.',
    !hasDeliveryMode && 'Seleccione un modo de entrega.',
    !hasDeliveryAddress && 'Seleccione una dirección.',
    !hasRequestedDate && 'Seleccione una fecha solicitada de envío.',
    !hasLanguage && 'No se pudo determinar LanguageId del usuario ni del cliente.',
    !hasRequiredFiscalData && 'Seleccione un NIF.',
  ].filter((message): message is string => Boolean(message));
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
      <div className="grid items-start gap-4 md:grid-cols-2">
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
          <CustomerAddressSelector
            customerAccount={draft.customer?.account ?? ''}
            selected={draft.deliveryAddress}
            onSelect={(deliveryAddress) => update({ deliveryAddress, taxExemptNumber: null })}
          />
          {draft.customer && !showNewAddress && (
            <Button size="sm" variant="outline" onClick={() => setShowNewAddress(true)}>
              Nueva dirección
            </Button>
          )}
          {draft.customer && showNewAddress && (
            <NewAddressForm
              customerAccount={draft.customer.account}
              onCancel={() => setShowNewAddress(false)}
              onCreated={(address) => {
                update({ deliveryAddress: address, taxExemptNumber: null });
                setShowNewAddress(false);
              }}
            />
          )}
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
          {showNif && !draft.deliveryAddress?.countryId && (
            <p className="text-xs text-on-surface-variant">
              NIF: seleccione una dirección para consultar documentos del país correspondiente.
            </p>
          )}
          {showNif && draft.deliveryAddress?.countryId && (
            <VatSelector
              countryId={draft.deliveryAddress.countryId}
              value={draft.taxExemptNumber}
              onChange={(taxExemptNumber) => update({ taxExemptNumber })}
            />
          )}
        </Card>
      </div>
      <DraftAttachments />
      {paymentRequired && !hasLocalPayment && (
        <Card className="border-amber-300 bg-amber-50 p-3">
          <strong>Comprobante de pago requerido</strong>
          <p className="text-xs">{hasPreparedImage ? "El comprobante debe tener la descripción 'pago'." : 'El comprobante debe ser JPG, JPEG o PNG.'}</p>
        </Card>
      )}
      {missingMessages.length > 0 && (
        <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-error">
          {missingMessages.map((message) => <li key={message}>{message}</li>)}
        </ul>
      )}
      <Button size="lg" fullWidth disabled={!ready} onClick={() => navigate('/crear-pedido/linea')}>
        Continuar a líneas
      </Button>
    </div>
  );
};
export default CreateOrderPage;

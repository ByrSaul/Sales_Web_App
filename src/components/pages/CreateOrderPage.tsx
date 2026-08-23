import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { useCustomerAddresses, useCustomers, useReferenceCatalogs } from '../../features/catalogs/hooks';
import type { Customer } from '../../features/catalogs/types';
import { useOrderDraft } from '../../features/orderDraft/OrderDraftProvider';
import { Button, Card, Input, Select } from '../ui';
import { ErrorState, LoadingState } from '../ui/PageState';

const CreateOrderPage = () => {
  const navigate = useNavigate(); const { context } = useSession(); const { draft, update } = useOrderDraft();
  const [search, setSearch] = useState(''); const customers = useCustomers(search, 1);
  const addresses = useCustomerAddresses(draft.customer?.account ?? ''); const refs = useReferenceCatalogs(draft.customer?.account ?? '', '');
  const currencies = context.company?.availableCurrencies ?? [];
  const chooseCustomer = (customer: Customer) => {
    if (draft.customer?.account === customer.account) return;
    if (draft.lines.length && !window.confirm('Cambiar cliente eliminará las líneas y datos comerciales dependientes. ¿Continuar?')) return;
    update({ customer, currencyCode: currencies.includes(customer.currency) ? customer.currency : draft.currencyCode, deliveryAddress: null, agreement: null, taxExemptNumber: null, lines: [] }); setSearch(`${customer.account} - ${customer.name}`);
  };
  const changeCurrency = (currencyCode: string) => { if (currencyCode === draft.currencyCode) return; if (draft.lines.length && !window.confirm('Cambiar moneda eliminará las líneas cuyos precios ya no son válidos. ¿Continuar?')) return; update({ currencyCode, lines: [] }); };
  const ready = Boolean(draft.customer && draft.deliveryMode && draft.deliveryAddress && draft.salesOrigin && draft.requestedShippingDate && currencies.includes(draft.currencyCode));
  return <div className="space-y-4 pb-12"><div><h1 className="text-xl font-bold">Encabezado del pedido</h1><p className="text-xs text-on-surface-variant">Borrador local · {draft.id}</p></div>
    <Card className="p-4 space-y-3"><h2 className="font-bold text-sm">Cliente</h2><Input label="Buscar por cuenta o nombre" value={search} onChange={e => setSearch(e.target.value)} icon="search" />
      {customers.isLoading && <LoadingState message="Cargando clientes..." />}{customers.isError && <ErrorState message="No se pudieron cargar los clientes." onRetry={() => customers.refetch()} />}
      {search && customers.data && !draft.customer && <div className="max-h-52 overflow-auto border rounded-lg">{customers.data.items.map(customer => <button type="button" key={customer.account} onClick={() => chooseCustomer(customer)} className="block w-full text-left p-3 border-b hover:bg-surface-container"><strong className="text-sm">{customer.account}</strong><span className="text-sm"> · {customer.name}</span><p className="text-xs text-on-surface-variant">{customer.currency} · {customer.paymentTerms}</p></button>)}</div>}
      {draft.customer && <div className="p-3 bg-primary/5 rounded-lg flex justify-between gap-3"><div><strong>{draft.customer.account} · {draft.customer.name}</strong><p className="text-xs">Crédito disponible USD: {draft.customer.creditAvailableUsd.toFixed(2)} · {draft.customer.blockedDescription}</p></div><Button size="sm" variant="ghost" onClick={() => { setSearch(''); update({ customer: null, deliveryAddress: null, agreement: null, taxExemptNumber: null, lines: [] }); }}>Cambiar</Button></div>}
    </Card>
    <div className="grid md:grid-cols-2 gap-4"><Card className="p-4 space-y-3"><h2 className="font-bold text-sm">Entrega y condiciones</h2>
      <Select label="Moneda" value={draft.currencyCode} onChange={e => changeCurrency(e.target.value)} options={[{ value: '', label: 'Seleccione...' }, ...currencies.map(value => ({ value, label: value }))]} />
      <Select label="Modo de entrega" value={draft.deliveryMode?.code ?? ''} onChange={e => update({ deliveryMode: refs.delivery.data?.find(x => x.code === e.target.value) ?? null })} options={[{ value: '', label: refs.delivery.isLoading ? 'Cargando...' : 'Seleccione...' }, ...(refs.delivery.data ?? []).map(x => ({ value: x.code, label: `${x.code} · ${x.description}` }))]} />
      <Select label="Dirección existente" disabled={!draft.customer || addresses.isLoading} value={draft.deliveryAddress?.locationId ?? ''} onChange={e => update({ deliveryAddress: addresses.data?.find(x => x.locationId === e.target.value) ?? null })} options={[{ value: '', label: addresses.isLoading ? 'Cargando...' : 'Seleccione...' }, ...(addresses.data ?? []).map(x => ({ value: x.locationId, label: `${x.description} · ${x.formattedAddress}` }))]} />
      {addresses.isError && <ErrorState message="No se pudieron cargar las direcciones." onRetry={() => addresses.refetch()} />}
      <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">Nueva dirección no disponible: BLOQUEANTE BACKEND — GET con JSON body incompatible con navegador.</p>
      <Input label="Fecha solicitada de envío" type="date" value={draft.requestedShippingDate} onChange={e => update({ requestedShippingDate: e.target.value })} />
    </Card><Card className="p-4 space-y-3"><h2 className="font-bold text-sm">Datos comerciales</h2>
      <Select label="Origen de venta" value={draft.salesOrigin?.id ?? ''} onChange={e => update({ salesOrigin: refs.origins.data?.find(x => x.id === e.target.value) ?? null })} options={[{ value: '', label: refs.origins.isLoading ? 'Cargando...' : 'Seleccione...' }, ...(refs.origins.data ?? []).map(x => ({ value: x.id, label: `${x.id} · ${x.description}` }))]} />
      <Select label="Acuerdo comercial (opcional)" disabled={!draft.customer || refs.agreements.isLoading} value={draft.agreement?.recId ?? ''} onChange={e => { const a = refs.agreements.data?.items.find(x => String(x.recId) === e.target.value); update({ agreement: a ? { recId: a.recId, number: a.number, title: a.title, currency: a.currency } : null }); }} options={[{ value: '', label: 'Sin acuerdo' }, ...(refs.agreements.data?.items ?? []).map(x => ({ value: String(x.recId), label: `${x.number} · ${x.title}` }))]} />
      <Input label="Referencia del cliente" value={draft.customerReference} onChange={e => update({ customerReference: e.target.value })} />
      <label className="flex flex-col gap-1 text-xs text-on-surface-variant">Observaciones<textarea rows={4} maxLength={1000} value={draft.observations} onChange={e => update({ observations: e.target.value })} className="p-3 rounded-lg border border-outline-variant text-sm text-on-surface" /></label>
      <div className="text-xs bg-surface-container p-2 rounded">NIT/documento: no disponible por el contrato GET con body. No se generarán valores ficticios.</div>
    </Card></div>
    {!ready && <p role="alert" className="text-sm text-error">Complete cliente, moneda, entrega, dirección, fecha y origen para continuar.</p>}<Button size="lg" fullWidth disabled={!ready} onClick={() => navigate('/crear-pedido/linea')}>Continuar a líneas</Button>
  </div>;
};
export default CreateOrderPage;

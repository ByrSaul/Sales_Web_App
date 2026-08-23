import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { statusLabel } from '../../features/orders/orderMappers';
import { useOrders } from '../../features/orders/orderQueries';
import type { OrderFilters } from '../../features/orders/orderTypes';
import { peekSubmission } from '../../features/orders/submissionStorage';
import { Button, Card, EmptyState, Input, Select } from '../ui';
import { ErrorState, LoadingState } from '../ui/PageState';
const fromParams = (p: URLSearchParams): OrderFilters => ({
  customer: p.get('customer') ?? '',
  status: p.get('status') ?? '',
  creditControl: p.get('credit') ?? '',
  from: p.get('from') ?? '',
  to: p.get('to') ?? '',
  page: Math.max(1, Number(p.get('page')) || 1),
  perPage: 10,
});
const OrdersPage = () => {
  const navigate = useNavigate();
  const { context } = useSession();
  const [params, setParams] = useSearchParams();
  const filters = fromParams(params);
  const [form, setForm] = useState(filters);
  const query = useOrders(filters);
  const recovery = peekSubmission(context.accountId);
  const apply = () => {
    const next: Record<string, string> = {};
    Object.entries({
      customer: form.customer,
      status: form.status,
      credit: form.creditControl,
      from: form.from,
      to: form.to,
    }).forEach(([k, v]) => {
      if (v) next[k] = String(v);
    });
    next.page = '1';
    setParams(next);
  };
  const page = (value: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(value));
    setParams(next);
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Mis pedidos de venta</h1>
          <p className="text-sm text-on-surface-variant">Información real de Dynamics 365.</p>
        </div>
        <Button onClick={() => navigate('/crear-pedido')}>Crear pedido</Button>
      </div>
      {recovery &&
        recovery.status !== 'completed' &&
        recovery.companyId === context.company?.id && (
          <Card className="p-3 bg-amber-50">
            <strong>Recuperación local pendiente</strong>
            <p className="text-xs">
              {recovery.salesOrderNumber
                ? `Pedido ${recovery.salesOrderNumber}`
                : 'Encabezado con resultado ambiguo'}{' '}
              · estado local {recovery.status}. No representa el estado oficial de Dynamics.
            </p>
            {recovery.salesOrderNumber && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() =>
                  navigate(`/pedidos/${encodeURIComponent(recovery.salesOrderNumber!)}`)
                }
              >
                Consultar pedido
              </Button>
            )}
          </Card>
        )}
      <Card className="p-4 space-y-3">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Input
            label="Desde"
            type="date"
            value={form.from}
            onChange={(e) => setForm({ ...form, from: e.target.value })}
          />
          <Input
            label="Hasta"
            type="date"
            value={form.to}
            onChange={(e) => setForm({ ...form, to: e.target.value })}
          />
          <Select
            label="Estado"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={[
              { value: '', label: 'Todos' },
              { value: 'Orden Abierta', label: 'Orden abierta' },
              { value: 'Entregado', label: 'Entregado' },
              { value: 'Facturado', label: 'Facturado' },
              { value: 'Cancelado', label: 'Cancelado' },
            ]}
          />
          <Input
            label="Cuenta cliente"
            value={form.customer}
            onChange={(e) => setForm({ ...form, customer: e.target.value })}
          />
          <Select
            label="Control de crédito"
            value={form.creditControl}
            onChange={(e) => setForm({ ...form, creditControl: e.target.value })}
            options={[
              { value: '', label: 'Todos' },
              { value: 'Si', label: 'En gestión' },
              { value: 'No', label: 'Fuera de gestión' },
            ]}
          />
        </div>
        <Button onClick={apply}>Buscar</Button>
      </Card>
      {query.isLoading && <LoadingState message="Cargando pedidos..." />}
      {query.isError && (
        <ErrorState message="No se pudo consultar el historial." onRetry={() => query.refetch()} />
      )}{' '}
      {query.data && !query.data.items.length && (
        <EmptyState
          title="No se encontraron pedidos"
          subtitle="Revise los filtros seleccionados."
        />
      )}
      <div className="grid xl:grid-cols-2 gap-3">
        {query.data?.items.map((order) => (
          <Card
            key={order.salesOrderNumber}
            className="p-4"
            hover
            onClick={() =>
              navigate(
                `/pedidos/${encodeURIComponent(order.salesOrderNumber)}?${params.toString()}`,
              )
            }
          >
            <div className="flex justify-between gap-2">
              <div>
                <strong>{order.salesOrderNumber}</strong>
                <p className="text-sm text-primary font-semibold">
                  {order.customerAccount} · {order.customerName}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs border rounded-full px-2 py-1">
                  {statusLabel(order.status)}
                </span>
                <p className="font-bold mt-1">
                  {order.currencyCode} {order.salesAmount.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 text-xs mt-3 gap-2">
              <p>
                Creación: <strong>{order.createdDate || '—'}</strong>
              </p>
              <p>
                Entrega: <strong>{order.deliveryDate || '—'}</strong>
              </p>
              <p>
                Grupo: <strong>{order.salesGroup}</strong>
              </p>
              <p>
                Crédito: <strong>{order.creditStatus}</strong>
              </p>
            </div>
          </Card>
        ))}
      </div>
      {query.data && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            disabled={filters.page <= 1}
            onClick={() => page(filters.page - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm">
            Página {query.data.pagination.currentPage} de {query.data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={filters.page >= query.data.pagination.totalPages}
            onClick={() => page(filters.page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
};
export default OrdersPage;

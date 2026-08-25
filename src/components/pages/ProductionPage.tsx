import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProduction } from '../../features/production/productionQueries';
import type {
  DailyProduction,
  ProductionFilters,
  SalesProduction,
} from '../../features/production/productionTypes';
import { Button, Card, EmptyState, Input, Select } from '../ui';
import { ErrorState, LoadingState } from '../ui/PageState';
/** Pantalla de consulta de producción por pedido o consolidado diario. */
const ProductionPage = () => {
  const [p, setP] = useSearchParams();
  const f: ProductionFilters = {
    mode: p.get('mode') === 'daily' ? 'daily' : 'orders',
    customer: p.get('customer') ?? '',
    item: p.get('item') ?? '',
    status: p.get('status') ?? '',
    from: p.get('from') ?? '',
    to: p.get('to') ?? '',
    delivery: p.get('delivery') ?? '',
    page: Math.max(1, Number(p.get('page') ?? 1)),
  };
  const [form, setForm] = useState(f);
  const q = useProduction(f);
  const apply = (x: ProductionFilters) =>
    setP({
      mode: x.mode,
      ...(x.customer ? { customer: x.customer } : {}),
      ...(x.item ? { item: x.item } : {}),
      ...(x.status ? { status: x.status } : {}),
      ...(x.from ? { from: x.from } : {}),
      ...(x.to ? { to: x.to } : {}),
      ...(x.delivery ? { delivery: x.delivery } : {}),
      page: String(x.page),
    });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Producción</h1>
      <Card className="p-4 grid md:grid-cols-4 gap-3">
        <Select
          label="Vista"
          value={form.mode}
          onChange={(e) => setForm({ ...form, mode: e.target.value as ProductionFilters['mode'] })}
          options={[
            { value: 'orders', label: 'Ligada a pedidos' },
            { value: 'daily', label: 'Producción diaria' },
          ]}
        />
        <Input
          label="Producto"
          value={form.item}
          onChange={(e) => setForm({ ...form, item: e.target.value })}
        />
        {form.mode === 'orders' && (
          <>
            <Input
              label="Cliente"
              value={form.customer}
              onChange={(e) => setForm({ ...form, customer: e.target.value })}
            />
            <Select
              label="Estado del pedido"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={[
                { value: '', label: 'Todos' },
                { value: 'Orden Abierta', label: 'Orden Abierta' },
                { value: 'Entregado', label: 'Entregado' },
                { value: 'Facturado', label: 'Facturado' },
                { value: 'Cancelado', label: 'Cancelado' },
              ]}
            />
          </>
        )}
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
        {form.mode === 'orders' && (
          <Input
            label="Fecha de despacho"
            type="date"
            value={form.delivery}
            onChange={(e) => setForm({ ...form, delivery: e.target.value })}
          />
        )}
        <Button
          disabled={Boolean(form.from && form.to && form.from > form.to)}
          onClick={() => apply({ ...form, page: 1 })}
        >
          Consultar
        </Button>
      </Card>
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState message="No se pudo consultar producción." onRetry={() => q.refetch()} />
      ) : !q.data?.items.length ? (
        <EmptyState title="No hay registros de producción para estos filtros" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full bg-white text-sm">
              <thead>
                <tr>
                  {f.mode === 'orders' ? (
                    <>
                      <th>Pedido</th>
                      <th>Producción</th>
                      <th>Cliente</th>
                      <th>Producto</th>
                      <th>Estado pedido</th>
                      <th>Estado producción</th>
                      <th>Cantidad</th>
                    </>
                  ) : (
                    <>
                      <th>Orden</th>
                      <th>Inicio</th>
                      <th>Fin</th>
                      <th>Producto</th>
                      <th>Cliente</th>
                      <th>Estado</th>
                      <th>Cantidad</th>
                      <th>Kilolitros</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((row, i) =>
                  f.mode === 'orders'
                    ? (() => {
                        const x = row as SalesProduction;
                        return (
                          <tr className="border-t" key={`${x.productionId}-${i}`}>
                            <td>{x.salesId}</td>
                            <td>{x.productionId}</td>
                            <td>{x.customer}</td>
                            <td>
                              {x.itemId}
                              <small className="block">{x.name}</small>
                            </td>
                            <td>{x.salesStatus}</td>
                            <td>
                              Código {x.productionStatus}
                              <small className="block">{x.backorderStatus}</small>
                            </td>
                            <td>{x.scheduledQuantity}</td>
                          </tr>
                        );
                      })()
                    : (() => {
                        const x = row as DailyProduction;
                        return (
                          <tr className="border-t" key={`${x.productionId}-${i}`}>
                            <td>{x.productionId}</td>
                            <td>{x.started}</td>
                            <td>{x.finished}</td>
                            <td>
                              {x.itemId}
                              <small className="block">{x.description}</small>
                            </td>
                            <td>
                              {x.customerAccount} · {x.customerName}
                            </td>
                            <td>{x.status}</td>
                            <td>{x.quantity}</td>
                            <td>{x.kiloliters}</td>
                          </tr>
                        );
                      })(),
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between">
            <span>{q.data.pagination.totalRecords} registros</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={f.page <= 1}
                onClick={() => apply({ ...f, page: f.page - 1 })}
              >
                Anterior
              </Button>
              <span className="p-2">
                {f.page}/{Math.max(1, q.data.pagination.totalPages)}
              </span>
              <Button
                variant="outline"
                disabled={f.page >= q.data.pagination.totalPages}
                onClick={() => apply({ ...f, page: f.page + 1 })}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
export default ProductionPage;

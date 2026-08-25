import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForecast } from '../../features/forecast/forecastQueries';
import type { ForecastFilters } from '../../features/forecast/forecastTypes';
import { Button, Card, EmptyState, Input, Select } from '../ui';
import { ErrorState, LoadingState } from '../ui/PageState';
/** Pantalla de consulta del pronóstico comercial del vendedor activo. */
const ForecastPage = () => {
  const [p, setP] = useSearchParams();
  const f: ForecastFilters = {
    from: p.get('from') ?? '',
    to: p.get('to') ?? '',
    item: p.get('item') ?? '',
    variant: p.get('variant') ?? '',
    customer: p.get('customer') ?? '',
    view: (p.get('view') as ForecastFilters['view']) || 'all',
    page: Math.max(1, Number(p.get('page') ?? 1)),
  };
  const [form, setForm] = useState(f);
  const q = useForecast(f);
  const apply = (x: ForecastFilters) =>
    setP({
      ...(x.from ? { from: x.from } : {}),
      ...(x.to ? { to: x.to } : {}),
      ...(x.item ? { item: x.item } : {}),
      ...(x.variant ? { variant: x.variant } : {}),
      ...(x.customer ? { customer: x.customer } : {}),
      view: x.view,
      page: String(x.page),
    });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Forecast de ventas</h1>
        <p className="text-xs">
          Consulta de Venta, Presupuesto y Proyección registrados en Dynamics. No es una predicción
          calculada por Web.
        </p>
      </div>
      <Card className="p-4 grid md:grid-cols-4 gap-3">
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
        <Input
          label="Producto"
          value={form.item}
          onChange={(e) => setForm({ ...form, item: e.target.value })}
        />
        <Input
          label="Variante"
          value={form.variant}
          onChange={(e) => setForm({ ...form, variant: e.target.value })}
        />
        <Input
          label="Cliente"
          value={form.customer}
          onChange={(e) => setForm({ ...form, customer: e.target.value })}
        />
        <Select
          label="Métrica"
          value={form.view}
          onChange={(e) => setForm({ ...form, view: e.target.value as ForecastFilters['view'] })}
          options={[
            { value: 'all', label: 'Todas' },
            { value: 'qty', label: 'Cantidad' },
            { value: 'amount', label: 'Importe' },
            { value: 'volume', label: 'Volumen' },
          ]}
        />
        <Button
          disabled={!form.from || !form.to || form.from > form.to}
          onClick={() => apply({ ...form, page: 1 })}
        >
          Consultar
        </Button>
      </Card>
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState message="No se pudo consultar el forecast." onRetry={() => q.refetch()} />
      ) : !q.data?.items.length ? (
        <EmptyState title="No hay forecast para estos filtros" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full bg-white text-sm">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Variante</th>
                  <th>Cliente</th>
                  <th>Venta</th>
                  <th>Presupuesto</th>
                  <th>Proyección</th>
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((x, i) => (
                  <tr className="border-t" key={`${x.itemId}-${x.variant}-${x.customer}-${i}`}>
                    <td>{x.itemId}</td>
                    <td>{x.variant}</td>
                    <td>{x.customer}</td>
                    <td>{x.salesQuantity ?? x.salesAmount ?? x.salesVolume ?? '—'}</td>
                    <td>{x.budgetQuantity ?? x.budgetAmount ?? x.budgetVolume ?? '—'}</td>
                    <td>
                      {x.projectionQuantity ?? x.projectionAmount ?? x.projectionVolume ?? '—'}
                    </td>
                  </tr>
                ))}
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
export default ForecastPage;

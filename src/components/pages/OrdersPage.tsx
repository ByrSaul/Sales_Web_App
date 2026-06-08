import React, { useState } from 'react';
import { Card, Icon, Input, Select } from '../ui';

type OrderStatus = 'FACTURADO' | 'PENDIENTE' | 'BORRADOR' | 'CANCELADO';

interface Order {
  id: string; status: OrderStatus; date: string; deliveryDate: string;
  clientCode: string; clientName: string; creditMgmt: string;
  creditControl: string; group: string; currency: string; total: number;
}

const ORDERS: Order[] = [
  { id: 'OV-083100', status: 'FACTURADO', date: '03-06-2026', deliveryDate: '03-06-2026', clientCode: 'LOC-000066', clientName: 'COMPAÑÍA DE DESARROLLO BANANERO DE GUATEMALA, S.A.', creditMgmt: 'No',          creditControl: 'N/D – FUERA_DE_GESTION', group: 'BC', currency: 'USD', total: 88857.36 },
  { id: 'OV-083095', status: 'FACTURADO', date: '02-06-2026', deliveryDate: '05-06-2026', clientCode: 'LOC-000142', clientName: 'FRUTAS DEL VALLE EXPORTACIONES LTDA.',              creditMgmt: 'Sí',         creditControl: 'APROBADO',               group: 'AC', currency: 'USD', total: 12450.00 },
  { id: 'OV-083105', status: 'PENDIENTE', date: 'Hoy, 08:30', deliveryDate: '10-06-2026', clientCode: 'LOC-000215', clientName: 'AGRICOLA DEL SUR COOP.',                           creditMgmt: 'En revisión', creditControl: 'PENDIENTE VALIDACIÓN',   group: 'BC', currency: 'USD', total: 4200.50 },
  { id: 'OV-083112', status: 'BORRADOR',  date: 'Hoy, 10:15', deliveryDate: 'TBD',        clientCode: '',           clientName: 'SIN ASIGNAR',                                      creditMgmt: '---',         creditControl: 'SIN PROCESAR',           group: 'BC', currency: 'USD', total: 0 },
];

const STATUS_BADGE: Record<OrderStatus, string> = {
  FACTURADO: 'bg-primary/10 text-primary border border-primary/20',
  PENDIENTE: 'bg-amber-50 text-amber-700 border border-amber-200',
  BORRADOR:  'bg-surface-container text-on-surface-variant border border-outline-variant',
  CANCELADO: 'bg-red-50 text-red-600 border border-red-200',
};
const AMOUNT_COLOR: Record<OrderStatus, string> = {
  FACTURADO: 'text-primary', PENDIENTE: 'text-secondary',
  BORRADOR: 'text-on-surface-variant', CANCELADO: 'text-error',
};
const CREDIT_CONTROL_COLOR = (val: string) =>
  val === 'APROBADO' ? 'text-primary font-semibold' :
  val.includes('PENDIENTE') ? 'text-secondary italic' : '';

// ─── Order Card — tamaño compacto ──────────────────────────────────────────────
const OrderCard: React.FC<{ order: Order; onView?: (id: string) => void }> = ({ order, onView }) => {
  const isDraft   = order.status === 'BORRADOR';
  const isPending = order.status === 'PENDIENTE';
  const isBilled  = order.status === 'FACTURADO';

  return (
    <Card className="overflow-hidden" hover>
      {/* Compact header strip */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-outline-variant/40">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-extrabold text-on-surface">{order.id}</h3>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_BADGE[order.status]}`}>
            {order.status}
          </span>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Total Pedido</p>
          <p className={`text-sm font-black leading-tight ${AMOUNT_COLOR[order.status]}`}>
            {order.total > 0 ? order.total.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '–––.––'}
          </p>
          <p className="text-[10px] text-on-surface-variant">{order.currency}</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-2.5 space-y-2">
        {/* Date row */}
        <p className="text-[11px] text-on-surface-variant flex items-center gap-1">
          <Icon name="calendar_today" size={11} />
          {order.date}
          {order.deliveryDate && order.deliveryDate !== 'TBD' && ` • Entrega: ${order.deliveryDate}`}
        </p>

        {/* 2-col detail grid — font smaller than v1 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <div className="col-span-2">
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Cuenta de Cliente</p>
            <p className="font-semibold leading-snug mt-0.5">
              {order.clientCode ? `${order.clientCode} – ` : ''}{order.clientName}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Gestión Crédito</p>
            <p className="font-semibold mt-0.5">{order.creditMgmt}</p>
          </div>
          <div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Control Crédito</p>
            <p className={`mt-0.5 font-semibold ${CREDIT_CONTROL_COLOR(order.creditControl)}`}>
              {order.creditControl}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Grupo</p>
            <p className="font-semibold mt-0.5">{order.group}</p>
          </div>
          <div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Moneda</p>
            <p className="font-semibold mt-0.5">{order.currency}</p>
          </div>
        </div>
      </div>

      {/* Action row */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-t border-outline-variant/30 flex-wrap"
        onClick={e => e.stopPropagation()}
      >
        {isDraft && (
          <button
            className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-[11px] font-semibold flex-1 justify-center hover:bg-primary/90 transition-colors"
            onClick={() => onView?.(order.id)}
          >
            <Icon name="play_arrow" size={13} /> Continuar pedido
          </button>
        )}
        {(isBilled || isPending) && (
          <button className="flex items-center gap-1 px-3 py-1.5 border border-outline-variant text-on-surface rounded-lg text-[11px] font-semibold flex-1 justify-center hover:bg-surface-container transition-colors">
            <Icon name="attach_file" size={13} /> Agregar adjunto
          </button>
        )}
        {isPending && (
          <button className="flex items-center gap-1 px-2.5 py-1.5 text-primary text-[11px] font-semibold hover:bg-primary/5 rounded-lg transition-colors">
            <Icon name="edit" size={13} /> Editar Pedido
          </button>
        )}

        {/* Icon buttons */}
        <button
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors"
          onClick={() => onView?.(order.id)}
          title="Ver detalle"
        >
          <Icon name="visibility" size={15} className="text-on-surface-variant" />
        </button>
        {(isDraft || isPending) && (
          <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors">
            <Icon name="delete" size={15} className="text-error" />
          </button>
        )}
        {!isDraft && (
          <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
            <Icon name="more_vert" size={15} className="text-on-surface-variant" />
          </button>
        )}
      </div>
    </Card>
  );
};

// ─── Filters panel ─────────────────────────────────────────────────────────────
interface FilterState {
  from: string; to: string; status: string; credit: string; client: string; group: string;
}
const FiltersPanel: React.FC<{ filters: FilterState; onChange: (p: Partial<FilterState>) => void }> = ({ filters, onChange }) => (
  <Card className="p-4 space-y-3">
    <div className="flex items-center gap-2">
      <Icon name="filter_list" size={16} className="text-primary" />
      <h3 className="text-sm font-bold">Filtros de Búsqueda</h3>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <Input label="DESDE" type="date" icon="calendar_today" value={filters.from} onChange={e => onChange({ from: e.target.value })} />
      <Input label="HASTA" type="date" icon="calendar_today" value={filters.to}   onChange={e => onChange({ to: e.target.value })} />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <Select label="ESTADO DE VENTA" value={filters.status} onChange={e => onChange({ status: e.target.value })}
        options={[{ value: 'all', label: 'Todos los estados' }, { value: 'FACTURADO', label: 'Facturado' }, { value: 'PENDIENTE', label: 'Pendiente' }, { value: 'BORRADOR', label: 'Borrador' }]} />
      <Select label="GESTIÓN DE CRÉDITO" value={filters.credit} onChange={e => onChange({ credit: e.target.value })}
        options={[{ value: 'all', label: 'Todo' }, { value: 'yes', label: 'Sí' }, { value: 'no', label: 'No' }]} />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <Input label="CUENTA / CLIENTE" placeholder="Buscar cliente por cuenta o nombre..." icon="search"
        value={filters.client} onChange={e => onChange({ client: e.target.value })} />
      <Select label="GRUPO DE VENTA" value={filters.group} onChange={e => onChange({ group: e.target.value })}
        options={[{ value: '', label: 'Seleccionar grupo...' }, { value: 'BC', label: 'BC' }, { value: 'AC', label: 'AC' }]} />
    </div>
    <button className="w-full py-2 bg-primary text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors">
      <Icon name="search" size={15} /> Buscar
    </button>
  </Card>
);

// ─── Pagination ────────────────────────────────────────────────────────────────
const Pagination: React.FC<{ current: number; total: number; onChange: (p: number) => void }> = ({ current, total, onChange }) => (
  <div className="flex items-center justify-end gap-1.5">
    <button disabled={current === 1} onClick={() => onChange(current - 1)}
      className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container disabled:opacity-40 transition-colors">
      <Icon name="chevron_left" size={16} />
    </button>
    {[1, 2].map(p => (
      <button key={p} onClick={() => onChange(p)}
        className={`w-8 h-8 text-sm font-bold rounded-lg transition-colors ${current === p ? 'bg-primary text-white' : 'border border-outline-variant hover:bg-surface-container text-on-surface'}`}>
        {p}
      </button>
    ))}
    <button onClick={() => onChange(current + 1)} disabled={current === total}
      className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container disabled:opacity-40 transition-colors">
      <Icon name="chevron_right" size={16} />
    </button>
  </div>
);

// ─── Page ──────────────────────────────────────────────────────────────────────
interface OrdersPageProps { onViewOrder?: (id: string) => void; }

const OrdersPage: React.FC<OrdersPageProps> = ({ onViewOrder }) => {
  const [filters, setFilters] = useState<FilterState>({
    from: '06/01/2026', to: '06/07/2026', status: 'all', credit: 'all', client: '', group: '',
  });
  const [page, setPage] = useState(1);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <nav className="flex items-center gap-1 text-xs text-on-surface-variant mb-1">
            <span>Inicio</span>
            <Icon name="chevron_right" size={12} />
            <span className="text-on-surface font-medium">Mis Pedidos</span>
          </nav>
          <h1 className="text-xl font-extrabold text-on-surface">Mis Pedidos de Venta</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Visualiza, filtra y gestiona tus órdenes de venta en tiempo real.
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap">
          <Icon name="add_circle" size={15} /> Crear nuevo pedido
        </button>
      </div>

      {/* Filters panel — always visible on desktop, collapsible on mobile */}
      <div className="hidden md:block">
        <FiltersPanel filters={filters} onChange={p => setFilters(f => ({ ...f, ...p }))} />
      </div>
      {/* Mobile collapsible filters */}
      <details className="md:hidden">
        <summary className="flex items-center gap-2 text-sm font-medium text-on-surface-variant cursor-pointer select-none list-none py-2">
          <Icon name="filter_list" size={16} className="text-primary" />
          Filtros de Búsqueda
          <Icon name="expand_more" size={16} />
        </summary>
        <div className="mt-2">
          <FiltersPanel filters={filters} onChange={p => setFilters(f => ({ ...f, ...p }))} />
        </div>
      </details>

      {/* Results header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-on-surface-variant">
          Mostrando <strong className="text-on-surface">1–10</strong> de{' '}
          <strong className="text-on-surface">19 pedidos</strong>
        </p>
        <Pagination current={page} total={2} onChange={setPage} />
      </div>

      {/* Orders grid — 2 columns on desktop, 1 on mobile */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {ORDERS.map(o => <OrderCard key={o.id} order={o} onView={onViewOrder} />)}
      </div>

      {/* Bottom pagination */}
      <div className="flex justify-end">
        <Pagination current={page} total={2} onChange={setPage} />
      </div>
    </div>
  );
};

export default OrdersPage;

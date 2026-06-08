import React, { useState } from 'react';
import { Card, Icon, Input, Select } from '../ui';

type InvoiceStatus = 'Cancelado' | 'Vigente' | 'Vencida';
interface Invoice {
  id: string; status: InvoiceStatus; type: string; order: string;
  clientCode: string; clientName: string; salesGroup: string;
  pendingAmount: number; invoiceAmount: number; currency: string;
  issueDate: string; dueDate: string; overdueDays: number;
}

const INVOICES: Invoice[] = [
  { id: 'F2022-013370', status: 'Cancelado', type: 'FCAM', order: 'OV-014891', clientCode: 'MOST-000001', clientName: 'LUIS ALFONSO MIRANDA LIMA',        salesGroup: 'BC', pendingAmount: 0,     invoiceAmount: 524.85,  currency: 'GTQ', issueDate: '03-11-2022', dueDate: '05-12-2022', overdueDays: 1280 },
  { id: 'F2024-009214', status: 'Vigente',   type: 'FCAM', order: 'OV-021045', clientCode: 'AGRO-00421',  clientName: 'AGROEXPORTACIONES DEL SUR S.A.',  salesGroup: 'AC', pendingAmount: 12400, invoiceAmount: 12400,   currency: 'GTQ', issueDate: '12-05-2024', dueDate: '12-06-2024', overdueDays: -15 },
  { id: 'F2024-005118', status: 'Vencida',   type: 'FCAM', order: 'OV-019882', clientCode: 'FERT-00122',  clientName: 'FERTILIZANTES DEL VALLE',          salesGroup: 'BC', pendingAmount: 8950,  invoiceAmount: 8950,    currency: 'GTQ', issueDate: '10-01-2024', dueDate: '10-02-2024', overdueDays: 120 },
];

const STATUS_HEADER: Record<InvoiceStatus, { bg: string; textColor: string; badgeBg: string; badgeText: string }> = {
  Cancelado: { bg: 'bg-surface-container',   textColor: 'text-on-surface-variant', badgeBg: 'bg-red-500',     badgeText: 'text-white' },
  Vigente:   { bg: 'bg-primary/5',           textColor: 'text-primary',            badgeBg: 'bg-primary/10',  badgeText: 'text-primary' },
  Vencida:   { bg: 'bg-red-50',              textColor: 'text-red-700',            badgeBg: 'bg-red-500',     badgeText: 'text-white' },
};

// ─── Invoice Card — v1 style ───────────────────────────────────────────────────
const InvoiceCard: React.FC<{ invoice: Invoice }> = ({ invoice }) => {
  const h = STATUS_HEADER[invoice.status];
  const isOverdue = invoice.status === 'Vencida';

  return (
    <Card className="overflow-hidden" hover>
      {/* Header */}
      <div className={`p-4 flex items-center gap-3 border-b border-outline-variant/30 ${h.bg}`}>
        <div className="p-2 bg-white rounded-lg shadow-sm">
          <Icon name="receipt" size={18} className={h.textColor} />
        </div>
        <div className="flex-1">
          <p className={`text-[11px] font-bold uppercase tracking-wide ${h.textColor}`}>No. Factura</p>
          <h3 className={`text-base font-extrabold ${h.textColor}`}>{invoice.id}</h3>
        </div>
        <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${h.badgeBg} ${h.badgeText}`}>
          {invoice.status === 'Cancelado' && <Icon name="cancel" size={12} />}
          {invoice.status === 'Vigente'   && <Icon name="check_circle" size={12} fill />}
          {invoice.status === 'Vencida'   && <Icon name="error" size={12} fill />}
          {invoice.status}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            { icon: 'description',    label: 'Tipo',         value: invoice.type },
            { icon: 'shopping_cart',  label: 'Orden',        value: invoice.order },
          ].map(r => (
            <div key={r.label} className="flex items-start gap-2">
              <Icon name={r.icon} size={14} className="text-on-surface-variant mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-on-surface-variant">{r.label}</p>
                <p className="font-bold mt-0.5">{r.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Client row */}
        <div className="flex items-start gap-2 text-xs pt-2 border-t border-outline-variant/20">
          <Icon name="person" size={14} className="text-on-surface-variant mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-on-surface-variant">Cliente</p>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="font-bold leading-tight">{invoice.clientName}</p>
              <span className="text-[10px] bg-surface-container px-2 py-0.5 rounded font-mono flex-shrink-0">{invoice.clientCode}</span>
            </div>
          </div>
        </div>

        {/* Amount cards */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className={`p-3 rounded-xl border ${isOverdue ? 'bg-red-50 border-red-200' : 'bg-secondary/5 border-secondary/10'}`}>
            <p className={`text-[10px] font-bold uppercase mb-1 ${isOverdue ? 'text-red-700' : 'text-secondary'}`}>Monto Pendiente</p>
            <p className={`text-base font-black leading-tight ${isOverdue ? 'text-red-700' : 'text-secondary'}`}>
              {invoice.currency}{invoice.pendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 rounded-xl border bg-primary/5 border-primary/10">
            <p className="text-[10px] text-primary font-bold uppercase mb-1">Monto Factura</p>
            <p className="text-base font-black text-primary leading-tight">
              {invoice.currency}{invoice.invoiceAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 bg-surface-container-lowest border-t border-outline-variant/30 flex items-center justify-between text-[11px]">
        <div className="flex gap-3">
          <span className="flex items-center gap-1 text-on-surface-variant">
            <Icon name="calendar_today" size={12} /> Fact: {invoice.issueDate}
          </span>
          <span className={`flex items-center gap-1 font-semibold ${isOverdue ? 'text-red-600' : 'text-on-surface'}`}>
            <Icon name="event" size={12} /> Vence: {invoice.dueDate}
          </span>
        </div>
        <span className={`font-bold flex items-center gap-1 ${isOverdue ? 'text-red-600' : invoice.overdueDays < 0 ? 'text-primary' : 'text-on-surface-variant'}`}>
          <Icon name={isOverdue ? 'warning' : 'timer'} size={12} />
          {isOverdue ? `${invoice.overdueDays} días de retraso` : invoice.overdueDays < 0 ? `Quedan ${Math.abs(invoice.overdueDays)} días` : `${invoice.overdueDays} días`}
        </span>
      </div>
    </Card>
  );
};

// ─── Filters sidebar ───────────────────────────────────────────────────────────
interface FiltersProps { onSearch: () => void; }
const FiltersSidebar: React.FC<FiltersProps> = ({ onSearch }) => {
  const [salesGroup, setSalesGroup] = useState('BC - BYRON CHACÓN');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hasPending, setHasPending] = useState(false);

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Icon name="tune" size={16} className="text-primary" />
          <h3 className="text-sm font-bold">Filtros Avanzados</h3>
        </div>
        <Select label="Grupo de venta" value={salesGroup} onChange={e => setSalesGroup(e.target.value)}
          options={[{ value: 'BC - BYRON CHACÓN', label: 'BC - BYRON CHACÓN' }, { value: 'AC', label: 'AC' }]} />
        <Input label="Cuenta de cliente" icon="search" placeholder="Buscar cliente..." />
        <Input label="Fecha inicial" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <Input label="Fecha final"   type="date" value={endDate}   onChange={e => setEndDate(e.target.value)} />
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={hasPending} onChange={e => setHasPending(e.target.checked)}
            className="w-4 h-4 rounded accent-primary border-outline-variant" />
          <span className="text-sm text-on-surface-variant">Tiene saldo pendiente</span>
        </label>
        <button onClick={onSearch} className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors">
          <Icon name="search" size={15} /> Buscar
        </button>
        <button className="w-full text-sm text-primary font-semibold hover:underline">Limpiar filtros</button>
      </Card>

      {/* Pending total */}
      <Card className="p-4 bg-primary border-0">
        <p className="text-[11px] text-white/70 uppercase tracking-widest font-bold mb-1">Total Pendiente</p>
        <p className="text-3xl font-black text-white">GTQ 125,480.00</p>
        <p className="text-xs text-white/60 flex items-center gap-1 mt-1">
          <Icon name="trending_up" size={13} /> +12% vs mes anterior
        </p>
      </Card>
    </div>
  );
};

// ─── Empty slot card ───────────────────────────────────────────────────────────
const NewInvoiceSlot: React.FC = () => (
  <div className="border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center p-8 text-center bg-surface-container/20 hover:border-primary hover:bg-primary/3 transition-all cursor-pointer group min-h-[200px]">
    <div className="w-14 h-14 bg-surface-container rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
      <Icon name="post_add" size={28} className="text-on-surface-variant group-hover:text-primary" />
    </div>
    <h3 className="text-sm font-bold mb-1">Crear nueva factura</h3>
    <p className="text-xs text-on-surface-variant max-w-[180px]">Agrega una nueva venta al registro rápidamente.</p>
  </div>
);

// ─── Page ──────────────────────────────────────────────────────────────────────
interface InvoicesPageProps { showSearch?: boolean; }
const InvoicesPage: React.FC<InvoicesPageProps> = ({ showSearch }) => {
  const [view, setView] = useState<'search' | 'list'>(showSearch ? 'search' : 'list');
  const [page, setPage] = useState(1);

  if (view === 'search') {
    return (
      <div className="max-w-lg space-y-4">
        <h1 className="text-xl font-extrabold hidden md:block">Consultar facturas de venta</h1>
        <FiltersSidebar onSearch={() => setView('list')} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Facturas de Venta</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Mostrando 1–10 de <strong>5,588</strong> facturas | Página 1 de 559
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 border border-outline-variant rounded-lg text-sm font-medium hover:bg-surface-container transition-colors">
            <Icon name="download" size={15} /> Exportar
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Icon name="add" size={15} /> Nueva Factura
          </button>
        </div>
      </div>

      {/* Layout: filters left + grid right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Filters — sidebar on desktop, collapsed on mobile */}
        <div className="hidden lg:block lg:col-span-3">
          <FiltersSidebar onSearch={() => {}} />
        </div>

        {/* Mobile filters toggle */}
        <details className="lg:hidden col-span-full">
          <summary className="flex items-center gap-2 text-sm font-medium text-on-surface-variant cursor-pointer select-none list-none py-2">
            <Icon name="tune" size={15} className="text-primary" /> Filtros Avanzados
            <Icon name="expand_more" size={15} />
          </summary>
          <div className="mt-2"><FiltersSidebar onSearch={() => {}} /></div>
        </details>

        {/* Invoice bento grid */}
        <div className="lg:col-span-9 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {INVOICES.map(inv => <InvoiceCard key={inv.id} invoice={inv} />)}
            {/*<NewInvoiceSlot />*/}
          </div>

          {/* Pagination */}
          <div className="flex justify-center">
            <nav className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-outline-variant shadow-sm">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container disabled:opacity-40 transition-colors">
                <Icon name="chevron_left" size={18} />
              </button>
              {[1, 2, 3].map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold transition-colors ${page === p ? 'bg-primary text-white' : 'hover:bg-surface-container'}`}>
                  {p}
                </button>
              ))}
              <span className="text-on-surface-variant text-sm px-1">...</span>
              <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container text-sm font-bold">5</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page === 5}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container disabled:opacity-40 transition-colors">
                <Icon name="chevron_right" size={18} />
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicesPage;

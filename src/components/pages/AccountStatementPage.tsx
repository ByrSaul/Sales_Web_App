import React, { useState } from 'react';
import { Card, Icon } from '../ui';

interface Voucher {
  id: string; amount: number; currency: string;
  status: 'current' | 'overdue'; dueDate: string; agingLabel: string;
}

const VOUCHERS: Voucher[] = [
  { id: 'F2026-004340', amount: 2588.77,  currency: 'USD', status: 'current', dueDate: '11 Jun', agingLabel: 'Al Día' },
  { id: 'F2026-004341', amount: 6260.80,  currency: 'USD', status: 'current', dueDate: '11 Jun', agingLabel: 'Al Día' },
  { id: 'F2026-004345', amount: 4338.32,  currency: 'USD', status: 'current', dueDate: '11 Jun', agingLabel: 'Al Día' },
  { id: 'F2026-004734', amount: 2132.48,  currency: 'USD', status: 'current', dueDate: '25 Jun', agingLabel: 'Al Día' },
  { id: 'F2026-004940', amount: 533.12,   currency: 'USD', status: 'current', dueDate: '25 Jun', agingLabel: 'Al Día' },
  { id: 'F2026-005898', amount: 2105.82,  currency: 'USD', status: 'current', dueDate: '09 Jul', agingLabel: 'Al Día' },
];

const TOTAL_CURRENT = 17959.31;
const TOTAL_OVERDUE = 0;

// ─── Estado de Cuenta ──────────────────────────────────────────────────────────
const AccountStatementPage: React.FC<{ onViewAging?: () => void }> = ({ onViewAging }) => {
  const [view, setView] = useState<'statement' | 'aging'>('statement');
  const [expanded, setExpanded] = useState(true);

  if (view === 'aging') {
    return (
      <div className="space-y-3">
        {/* Client info */}
        <div className="mb-2">
          <h2 className="text-base font-extrabold text-on-surface">PRODUCTOS AGRICOLAS DE ORIENTE S.A.</h2>
          <p className="text-xs text-on-surface-variant">LOC-000027</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-primary p-3">
            <p className="text-[10px] text-white/70 uppercase font-bold mb-1">Total Corriente</p>
            <p className="text-base font-extrabold text-white">USD{TOTAL_CURRENT.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[10px] text-on-surface-variant uppercase font-bold mb-1">Facturas Filtradas</p>
            <p className="text-base font-extrabold">{VOUCHERS.length} Documentos</p>
          </Card>
        </div>

        {/* Vouchers */}
        <div className="space-y-2">
          {VOUCHERS.map(v => (
            <Card key={v.id} className="p-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[10px] text-on-surface-variant uppercase font-bold">Voucher</p>
                  <p className="text-sm font-bold">{v.id}</p>
                </div>
                <span className="text-xs px-2 py-0.5 bg-surface-container rounded-full text-on-surface-variant font-medium">{v.agingLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-on-surface-variant uppercase font-bold">Monto Total</p>
                  <p className="text-sm font-bold">{v.currency}{v.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-primary">
                    <Icon name="check_circle" size={13} fill />
                    <span className="text-xs font-semibold">Corriente</span>
                  </div>
                  <p className="text-xs text-on-surface-variant">Fecha: {v.dueDate}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <button onClick={() => setView('statement')} className="text-xs text-primary font-medium flex items-center gap-1">
          <Icon name="arrow_back" size={13} /> Volver a Estado de Cuenta
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-base font-bold hidden md:block">Estado de Cuenta</h1>

      {/* Client */}
      <div>
        <h2 className="text-base font-extrabold">PRODUCTOS AGRICOLAS DE ORIENTE S.A.</h2>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon name="check_circle" size={14} className="text-primary" fill />
            <span className="text-xs font-semibold text-primary">Corriente</span>
          </div>
          <p className="text-base font-extrabold">USD{TOTAL_CURRENT.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">{VOUCHERS.length} documentos</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon name="warning" size={14} className="text-error" />
            <span className="text-xs font-semibold text-error">Vencido</span>
          </div>
          <p className="text-base font-extrabold">USD{TOTAL_OVERDUE.toFixed(2)}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">0 documentos</p>
        </Card>
      </div>

      {/* Corriente expandable */}
      <Card>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 p-3"
        >
          <Icon name="inventory" size={16} className="text-on-surface-variant" />
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">Corriente</p>
            <p className="text-xs text-on-surface-variant">06 Documentos · Total al día</p>
          </div>
          <Icon name={expanded ? 'expand_less' : 'expand_more'} size={18} className="text-on-surface-variant" />
        </button>
      </Card>

      {/* Aging section */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Icon name="history" size={14} className="text-on-surface-variant" />
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Antigüedad de Deuda (Vencido)</p>
        </div>
        <Card className="p-3 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm">Corriente</span>
            <span className="text-sm font-semibold text-primary">USD{TOTAL_CURRENT.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Vencido</span>
            <span className="text-sm font-semibold text-error">USD{TOTAL_OVERDUE.toFixed(2)}</span>
          </div>
          <div className="border-t border-outline-variant pt-2 flex justify-between">
            <span className="text-sm font-bold">Saldo total</span>
            <span className="text-sm font-bold">USD{TOTAL_CURRENT.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </Card>
      </div>

      <button
        onClick={() => setView('aging')}
        className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
      >
        Ver antigüedad de saldo <Icon name="chevron_right" size={13} />
      </button>
    </div>
  );
};

export default AccountStatementPage;

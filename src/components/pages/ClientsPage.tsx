import React, { useState } from 'react';
import { Badge, BottomSheet, Button, Card, Icon, Input } from '../ui';

type ClientStatus = 'ACTIVO' | 'BLOQUEADO';
interface Client { code: string; name: string; status: ClientStatus; available: number; currency: string; terms: string; blockedType?: string; }
interface Address { name: string; street: string; postal: string; city: string; tags: string[]; }
interface OrderHistItem { id: string; amount: number; currency: string; status: string; date: string; }
interface ClientDetail {
  code: string; name: string; blocked: boolean; currency: string;
  creditLimit: number; available: number; terms: string;
  salesGroup: string; country: string; locale: string;
  addresses: Address[]; orderHistory: OrderHistItem[];
}

const CLIENTS: Client[] = [
  { code: 'LOC-000021', name: 'CASA EXPORT LIMITED',                  status: 'ACTIVO',    available: 104996.11, currency: 'USD', terms: '30D' },
  { code: 'LOC-000027', name: 'PRODUCTOS AGRICOLAS DE ORIENTE S.A.',  status: 'ACTIVO',    available: 507021.23, currency: 'USD', terms: '60D' },
  { code: 'LOC-000041', name: 'ARNOLDO OSWALDO VARGAS',               status: 'BLOQUEADO', available: 0,         currency: 'USD', terms: '30D', blockedType: 'Todo' },
];

const DETAIL: ClientDetail = {
  code: 'LOC-000021', name: 'CASA EXPORT LIMITED', blocked: false,
  currency: 'GTQ', creditLimit: 105000, available: 104996.11,
  terms: '30D', salesGroup: 'BC', country: 'GTM', locale: 'es-MX',
  addresses: [
    { name: 'CASA EXPORT LIMITED', street: 'Centro 1, La maquina', postal: '10002', city: 'Retalhuleu', tags: ['Delivery', 'GTM'] },
    { name: 'CASA EXPORT LIMITED', street: 'Centro 1',             postal: '10002', city: '',           tags: ['Delivery', 'GTM'] },
    { name: 'CASA EXPORT LIMITED', street: '12016',                postal: '',      city: 'Catarina',   tags: ['Delivery', 'GTM'] },
  ],
  orderHistory: [
    { id: '#88219', amount: 12400, currency: 'USD', status: 'Entregado',  date: '24 Oct. 2023' },
    { id: '#89041', amount: 8120,  currency: 'USD', status: 'En Proceso', date: 'Hoy, 10:45 AM' },
  ],
};

// ─── Client list item (sidebar) ────────────────────────────────────────────────
const ClientListItem: React.FC<{ client: Client; selected: boolean; onSelect: () => void }> = ({ client, selected, onSelect }) => {
  const blocked = client.status === 'BLOQUEADO';
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selected ? 'border-primary bg-primary/5' : 'border-outline-variant bg-white hover:border-primary/40'}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-xs text-primary font-bold">{client.code}</p>
          {blocked && client.blockedType && <p className="text-xs text-red-500">Tipo de bloqueo: {client.blockedType}</p>}
          <p className={`text-sm font-semibold mt-0.5 ${blocked ? 'text-red-600' : 'text-on-surface'}`}>{client.name}</p>
        </div>
        <Badge label={client.status === 'ACTIVO' ? 'Activo' : 'Bloqueado'} variant={blocked ? 'blocked' : 'success'} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <Icon name="credit_card" size={13} className="text-on-surface-variant" />
          <div>
            <p className="text-[10px] text-on-surface-variant">Crédito Disp.</p>
            <p className={`font-semibold ${blocked ? 'text-red-500' : 'text-on-surface'}`}>
              {client.currency} {client.available.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Icon name="monetization_on" size={13} className="text-on-surface-variant" />
          <div>
            <p className="text-[10px] text-on-surface-variant">Moneda</p>
            <p className="font-semibold">{client.currency}</p>
          </div>
        </div>
      </div>
    </button>
  );
};

// ─── Client Detail Panel (right side) ─────────────────────────────────────────
const ClientDetailPanel: React.FC<{ detail: ClientDetail; onEstadoCuenta: () => void }> = ({ detail, onEstadoCuenta }) => (
  <div className="space-y-4">
    {/* Hero header */}
    <Card className="overflow-hidden">
      <div className="bg-primary p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon name="person" size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">{detail.name}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Icon name="verified" size={13} className="text-white/60" fill />
              <p className="text-xs text-white/70">Cuenta: {detail.code} • Sector Agrícola</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
            <Icon name="edit" size={16} className="text-white" />
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
            <Icon name="more_vert" size={16} className="text-white" />
          </button>
          <button className="px-3 py-1.5 border border-white/40 text-white rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">
            Nuevo Pedido
          </button>
        </div>
      </div>

      {/* Info grid */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: 'credit_score', label: 'LÍMITE CRÉDITO',  value: `USD ${detail.creditLimit.toLocaleString()}`, sub: `${((detail.available/detail.creditLimit)*100).toFixed(1)}% disponible`, subColor: 'text-primary' },
          { icon: 'schedule',     label: 'PLAZO PAGO',       value: detail.terms,       sub: 'Facturación Neta', subColor: '' },
          { icon: 'public',       label: 'UBICACIÓN',        value: detail.country,     sub: detail.currency,    subColor: '' },
          { icon: 'translate',    label: 'IDIOMA',            value: detail.locale,      sub: 'Español México',  subColor: '' },
        ].map(c => (
          <Card key={c.label} className="p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon name={c.icon} size={14} className="text-primary" />
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wide font-bold">{c.label}</p>
            </div>
            <p className="text-base font-extrabold text-on-surface leading-tight">{c.value}</p>
            {c.sub && <p className={`text-xs mt-0.5 ${c.subColor || 'text-on-surface-variant'}`}>{c.sub}</p>}
          </Card>
        ))}
      </div>
    </Card>

    {/* Addresses + Map + History */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Addresses + map */}
      <div className="lg:col-span-7 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Icon name="location_on" size={16} className="text-primary" />
            Direcciones Registradas
          </h3>
          <button className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5">
            Ver todas (7) <Icon name="chevron_right" size={13} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {detail.addresses.map((addr, i) => (
            <Card key={i} className="p-3">
              <div className="flex items-start gap-2.5">
                <Icon name="location_on" size={15} className="text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">{addr.name}</p>
                  <p className="text-xs text-on-surface-variant">{addr.street}</p>
                  {addr.postal && <p className="text-xs text-on-surface-variant">{addr.postal}</p>}
                  {addr.city && <p className="text-xs text-on-surface-variant">{addr.city}</p>}
                  <div className="flex gap-1 mt-1.5">
                    {addr.tags.map(t => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
        {/* Map placeholder */}
        <Card className="overflow-hidden h-44 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Icon name="map" size={48} className="text-primary/20" />
          </div>
          <button className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-full text-xs font-semibold shadow hover:bg-white transition-colors">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> Ver en Tiempo Real
          </button>
        </Card>
      </div>

      {/* Operative detail */}
      <div className="lg:col-span-5 space-y-3">
        <Card className="p-4">
          <h3 className="text-sm font-bold mb-3">Detalle Operativo</h3>
          <p className="text-sm font-semibold mb-2 flex items-center gap-2">
            Historial de Pedidos
            <Icon name="history" size={15} className="text-on-surface-variant" />
          </p>
          {detail.orderHistory.map(item => (
            <div key={item.id} className="flex items-start gap-2.5 py-2.5 border-b border-outline-variant/30 last:border-0">
              <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${item.status === 'Entregado' ? 'bg-primary' : 'bg-secondary'}`} />
              <div className="flex-1">
                <div className="flex justify-between">
                  <p className="text-xs font-bold text-primary">Pedido {item.id}</p>
                  <p className="text-[11px] text-on-surface-variant">{item.date}</p>
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  {item.currency} {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} • {item.status}
                </p>
              </div>
            </div>
          ))}
          <button className="mt-2 text-xs text-primary font-semibold hover:underline">Ver Reporte Completo</button>
        </Card>

        {/* Estado de cuenta card */}
        <button
          onClick={onEstadoCuenta}
          className="w-full flex items-center gap-3 p-3.5 bg-white border border-outline-variant rounded-xl hover:bg-surface-container/50 transition-colors text-left"
        >
          <div className="w-9 h-9 bg-error-container rounded-lg flex items-center justify-center">
            <Icon name="receipt_long" size={18} className="text-error" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">Estado de Cuenta</p>
            <p className="text-xs text-on-surface-variant">Actualizado hace 2h</p>
          </div>
          <Icon name="chevron_right" size={16} className="text-on-surface-variant" />
        </button>
      </div>
    </div>
  </div>
);

// ─── Search bottom sheet (mobile) / inline search (desktop) ───────────────────
const SearchClientSheet: React.FC<{ open: boolean; onClose: () => void; onSelect: (c: Client) => void }> = ({ open, onClose, onSelect }) => {
  const [q, setQ] = useState('');
  const filtered = CLIENTS.filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || c.code.includes(q));
  return (
    <BottomSheet open={open} onClose={onClose} title="Buscar Cliente">
      <Input icon="search" placeholder="Buscar por cuenta o nombre..." value={q} onChange={e => setQ(e.target.value)} className="mb-3" />
      <div className="space-y-2">
        {filtered.map(c => <ClientListItem key={c.code} client={c} selected={false} onSelect={() => { onSelect(c); onClose(); }} />)}
      </div>
    </BottomSheet>
  );
};

// ─── Page ──────────────────────────────────────────────────────────────────────
interface ClientsPageProps { onEstadoCuenta?: () => void; }
const ClientsPage: React.FC<ClientsPageProps> = ({ onEstadoCuenta }) => {
  const [selected, setSelected] = useState<Client>(CLIENTS[0]);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left sidebar — client list */}
      <aside className="lg:col-span-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-on-surface">Mis Clientes</h1>
            <p className="text-sm text-on-surface-variant">124 clientes asignados</p>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Icon name="person_add" size={15} /> Nuevo
          </button>
        </div>
        <Input placeholder="Buscar por cuenta o nombre..." icon="search" onClick={() => setSearchOpen(true)} readOnly className="cursor-pointer" />
        <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
          {CLIENTS.map(c => (
            <ClientListItem key={c.code} client={c} selected={selected.code === c.code} onSelect={() => setSelected(c)} />
          ))}
        </div>
      </aside>

      {/* Right — detail */}
      <section className="lg:col-span-8 overflow-y-auto max-h-[calc(100vh-80px)] pr-1">
        <ClientDetailPanel detail={DETAIL} onEstadoCuenta={() => onEstadoCuenta?.()} />
      </section>

      {/* Mobile search sheet */}
      <SearchClientSheet open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={c => { setSelected(c); }} />
    </div>
  );
};

export default ClientsPage;

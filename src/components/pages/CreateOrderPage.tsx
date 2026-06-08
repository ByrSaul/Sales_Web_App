import React, { useState } from 'react';
import { BottomSheet, Button, Card, Icon, Input, Select, Toggle } from '../ui';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface DeliveryMode { code: string; name: string; }
interface Address { name: string; street: string; postal: string; city: string; tags: string[]; }

// ─── Mock data ──────────────────────────────────────────────────────────────────
const DELIVERY_MODES: DeliveryMode[] = [
  { code: 'PROPIO',      name: 'REPARTO PROPIO' },
  { code: 'GUATEX',      name: 'GUATEX' },
  { code: 'TERCERIZAD',  name: 'TERCERIZADO' },
  { code: 'C-EXPRESSO',  name: 'CARGO EXPRESSO' },
  { code: 'FORZA',       name: 'FORZA' },
  { code: 'VENDEDOR',    name: 'RECOGE VENDEDOR' },
  { code: 'XTRA-URBAN',  name: 'EXTRA URBANO' },
  { code: 'CLIENTF',     name: 'RECOGE CLIENTE' },
];

const CLIENT_ADDRESSES: Address[] = [
  { name: 'CASA EXPORT LIMITED', street: 'Centro 1, La maquina', postal: '10002', city: '',         tags: ['Delivery', 'GTM'] },
  { name: 'CASA EXPORT LIMITED', street: 'Centro 1',             postal: '10002', city: '',         tags: ['Delivery', 'GTM'] },
  { name: 'CASA EXPORT LIMITED', street: '12016',                postal: '',      city: 'Catarina', tags: ['Delivery', 'GTM'] },
];

// ─── Delivery Mode Bottom Sheet ─────────────────────────────────────────────────
interface DeliverySheetProps { open: boolean; onClose: () => void; selected: string; onSelect: (m: DeliveryMode) => void; }
const DeliveryModeSheet: React.FC<DeliverySheetProps> = ({ open, onClose, selected, onSelect }) => (
  <BottomSheet open={open} onClose={onClose} title="Seleccionar Modo de Entrega">
    <div className="space-y-2">
      {DELIVERY_MODES.map(mode => {
        const isSelected = mode.code === selected;
        return (
          <button
            key={mode.code}
            onClick={() => { onSelect(mode); onClose(); }}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-outline-variant hover:bg-surface-container'}`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isSelected ? 'bg-primary' : 'bg-surface-container-high'}`}>
              <Icon name="local_shipping" size={18} className={isSelected ? 'text-white' : 'text-on-surface-variant'} />
            </div>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{mode.name}</p>
              <p className="text-xs text-on-surface-variant">Código: {mode.code}</p>
            </div>
            {isSelected && <Icon name="check_circle" size={18} className="text-primary" fill />}
          </button>
        );
      })}
    </div>
  </BottomSheet>
);

// ─── Addresses Bottom Sheet ─────────────────────────────────────────────────────
interface AddressSheetProps { open: boolean; onClose: () => void; onSelect: (a: Address) => void; }
const AddressSheet: React.FC<AddressSheetProps> = ({ open, onClose, onSelect }) => (
  <BottomSheet open={open} onClose={onClose} title="Direcciones del Cliente">
    <div className="mb-3">
      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
        <Icon name="arrow_downward" size={16} className="text-primary" />
      </div>
    </div>
    <div className="space-y-2">
      {CLIENT_ADDRESSES.map((addr, i) => (
        <button
          key={i}
          onClick={() => { onSelect(addr); onClose(); }}
          className="w-full flex items-start gap-3 p-3 rounded-xl border border-outline-variant hover:bg-surface-container text-left transition-colors"
        >
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Icon name="location_on" size={15} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">{addr.name}</p>
            <p className="text-xs text-on-surface-variant">{addr.street}</p>
            {addr.postal && <p className="text-xs text-on-surface-variant underline">{addr.postal}</p>}
            {addr.city && <p className="text-xs text-on-surface-variant">{addr.city}</p>}
            <div className="flex gap-1 mt-1">
              {addr.tags.map(t => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium">{t}</span>
              ))}
            </div>
          </div>
        </button>
      ))}
    </div>
  </BottomSheet>
);

// ─── Page ──────────────────────────────────────────────────────────────────────
interface CreateOrderPageProps { onNext?: () => void; }
const CreateOrderPage: React.FC<CreateOrderPageProps> = ({ onNext }) => {
  const [client, setClient] = useState('LOC-000021 - CASA EXPO...');
  const [deliveryMode, setDeliveryMode] = useState('REPARTO PROPIO');
  const [selectedModeCode, setSelectedModeCode] = useState('PROPIO');
  const [address, setAddress] = useState('CASA EXPORT LIMITED');
  const [observations, setObservations] = useState('');
  const [clientRef, setClientRef] = useState('');
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);

  return (
    <div className="space-y-3 pb-20">
      <h1 className="text-base font-bold hidden md:block">Crear pedido</h1>

      {/* Client field */}
      <div>
        <p className="text-xs text-on-surface-variant mb-1">Cuenta de Cliente</p>
        <div className="flex items-center gap-2 border border-outline-variant rounded-lg px-3 py-2 bg-white">
          <span className="text-sm flex-1">{client}</span>
          <button onClick={() => setClient('')}><Icon name="close" size={14} className="text-on-surface-variant" /></button>
          <Icon name="search" size={15} className="text-primary" />
        </div>
      </div>

      {/* Client balance card */}
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="account_balance_wallet" size={16} className="text-primary" />
          <h3 className="text-sm font-bold">Balance del cliente</h3>
        </div>
        {[
          { label: 'Grupo de ventas:',        value: 'BC' },
          { label: 'Cuenta cliente:',         value: 'LOC-000021' },
          { label: 'Nombre:',                 value: 'CASA EXPORT LIMITED' },
          { label: 'Divisa:',                 value: 'GTQ' },
          { label: 'Condiciones de pago:',    value: '30D' },
          { label: 'Descripción de bloqueo:', value: 'Ninguno' },
        ].map(row => (
          <div key={row.label} className="flex items-baseline gap-2 py-1.5 border-b border-outline-variant/20 last:border-0">
            <span className="text-xs text-on-surface-variant flex-shrink-0 w-36">{row.label}</span>
            <span className="text-xs font-semibold text-right flex-1">{row.value}</span>
          </div>
        ))}
        <div className="mt-2 px-3 py-2 bg-surface-container-low rounded-lg">
          <span className="text-xs text-on-surface-variant">Limite de crédito USD: </span>
          <span className="text-xs font-bold">$104,996.11</span>
        </div>
      </Card>

      {/* Info notice */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
        <Icon name="info" size={14} className="text-amber-600 flex-shrink-0" />
        <p className="text-xs text-amber-700">Este cliente no tiene paquetes disponibles.</p>
      </div>

      {/* Delivery mode */}
      <div>
        <p className="text-xs text-on-surface-variant mb-1">Modo de Entrega</p>
        <button
          onClick={() => setDeliveryOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2.5 border border-outline-variant rounded-lg bg-white hover:border-primary transition-colors"
        >
          <span className="text-sm font-medium">{deliveryMode}</span>
          <Icon name="arrow_drop_down" size={18} className="text-on-surface-variant" />
        </button>
      </div>

      {/* Sale origin */}
      <div>
        <p className="text-xs text-on-surface-variant mb-1">Origen de venta</p>
        <button className="w-full flex items-center justify-between px-3 py-2.5 border border-outline-variant rounded-lg bg-white">
          <span className="text-sm text-on-surface-variant/60">Seleccionar...</span>
          <Icon name="arrow_drop_down" size={18} className="text-on-surface-variant" />
        </button>
      </div>

      {/* Delivery address */}
      <div>
        <p className="text-xs text-on-surface-variant mb-1">Dirección de entrega</p>
        <button
          onClick={() => setAddressOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 border border-outline-variant rounded-lg bg-white hover:border-primary transition-colors"
        >
          <Icon name="location_on" size={14} className="text-primary" />
          <span className="text-sm flex-1 text-left">{address}</span>
          <Icon name="chevron_right" size={15} className="text-on-surface-variant" />
        </button>
        <button className="mt-2 flex items-center gap-1.5 text-primary text-xs font-medium border border-primary/30 rounded-full px-3 py-1 hover:bg-primary/5 transition-colors">
          <Icon name="add" size={13} />
          Crear nueva dirección
        </button>
      </div>

      {/* Attachments */}
      <button className="w-full flex items-center gap-2 px-3 py-2.5 border border-outline-variant rounded-lg bg-white hover:bg-surface-container transition-colors">
        <Icon name="attach_file" size={14} className="text-on-surface-variant" />
        <span className="text-sm flex-1 text-left">Adjuntos</span>
        <Icon name="chevron_right" size={15} className="text-on-surface-variant" />
      </button>

      {/* Client reference */}
      <div>
        <input
          value={clientRef}
          onChange={e => setClientRef(e.target.value)}
          placeholder="Referencia del cliente"
          className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-primary"
        />
      </div>

      {/* Observations */}
      <div>
        <textarea
          value={observations}
          onChange={e => setObservations(e.target.value)}
          placeholder="Observaciones"
          rows={3}
          maxLength={1000}
          className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-primary resize-none"
        />
        <p className="text-right text-[10px] text-on-surface-variant">{observations.length}/1000</p>
      </div>

      {/* Submit */}
      <button
        onClick={onNext}
        className="
        fixed bottom-0 left-0 right-0
        md:relative md:bottom-auto
        bg-primary text-white
        px-8
        py-5
        text-base
        font-bold
        flex items-center justify-center gap-2
        hover:bg-primary/90
        transition-colors
        md:rounded-xl
      "
    >
        Siguiente
      </button>

      {/* Sheets */}
      <DeliveryModeSheet
        open={deliveryOpen} onClose={() => setDeliveryOpen(false)}
        selected={selectedModeCode}
        onSelect={m => { setDeliveryMode(m.name); setSelectedModeCode(m.code); }}
      />
      <AddressSheet open={addressOpen} onClose={() => setAddressOpen(false)} onSelect={a => setAddress(a.name)} />
    </div>
  );
};

export default CreateOrderPage;

import React, { useState } from 'react';
import { BottomSheet, Card, Icon, Select, Toggle } from '../ui';

type StockStatus = 'available' | 'out_of_stock' | 'low_stock';
interface Product { code: string; name: string; type: string; dimensions: string; }

const PRODUCTS: Product[] = [
  { code: 'HB-000001', name: 'ACETOFOR 90 EC',  type: 'MasterProduct', dimensions: 'DEST + PPT' },
  { code: 'HB-000002', name: 'AGRESIVO 20 SL',  type: 'MasterProduct', dimensions: 'DEST + PPT' },
  { code: 'HB-000003', name: 'AMEFOR 50 SC',    type: 'MasterProduct', dimensions: 'DEST + PPT' },
  { code: 'HB-000004', name: 'AMETRINA 50 SC',  type: 'MasterProduct', dimensions: 'DEST + PPT' },
];

const STATUS_CFG: Record<StockStatus, { label: string; badge: string; border: string; valueColor: string }> = {
  available:    { label: 'Disponible', badge: 'bg-primary text-white',   border: 'border-primary/30',  valueColor: 'text-primary' },
  out_of_stock: { label: 'Sin Stock',  badge: 'bg-red-500 text-white',   border: 'border-red-200',     valueColor: 'text-red-500' },
  low_stock:    { label: 'Stock Bajo', badge: 'bg-amber-500 text-white', border: 'border-amber-200',   valueColor: 'text-amber-600' },
};

const BAR_DATA = [0.5, 0.65, 0.35, 0.75, 1, 0.65, 0.25];

// Product search sheet
const ProductSearchSheet: React.FC<{ open: boolean; onClose: () => void; onSelect: (p: Product) => void }> = ({ open, onClose, onSelect }) => {
  const [q, setQ] = useState('');
  const filtered = PRODUCTS.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase()));
  return (
    <BottomSheet open={open} onClose={onClose} title="Buscar Producto">
      <div className="flex items-center gap-2 border border-outline-variant rounded-lg px-3 py-2 mb-3">
        <Icon name="search" size={16} className="text-primary" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="hb" className="flex-1 text-sm outline-none" autoFocus />
      </div>
      <div className="space-y-2">
        {filtered.map(p => (
          <button key={p.code} onClick={() => { onSelect(p); onClose(); }}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-container-low hover:bg-primary/5 text-left border border-outline-variant/40 transition-colors">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon name="inventory_2" size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold">{p.name}</p>
              <p className="text-xs text-on-surface-variant">Código de artículo: {p.code}</p>
              <p className="text-xs text-on-surface-variant">Tipo: {p.type}</p>
              <p className="text-xs text-on-surface-variant">Grupo de dimensiones de producto: {p.dimensions}</p>
            </div>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
};

const InventoryPage: React.FC = () => {
  const [searchValue, setSearchValue] = useState('HB-000001 - ACETOFOR 90 EC');
  const [forceVariant, setForceVariant] = useState(true);
  const [region, setRegion] = useState('Guatemala');
  const [variant, setVariant] = useState('HB-000001-14 - G / 200 LT');
  const [searchOpen, setSearchOpen] = useState(false);
  const stockStatus: StockStatus = 'out_of_stock';
  const cfg = STATUS_CFG[stockStatus];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold hidden md:block">Consulta de Inventario</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left — search & selectors */}
        <div className="lg:col-span-8 space-y-4">
          {/* Product search card */}
          <Card className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-on-surface-variant mb-0.5">Codigo de artículo - Descripción</p>
                <h2 className="text-lg font-extrabold">Buscador de Productos</h2>
              </div>
              <div className="flex items-center gap-3 bg-surface-container px-3 py-2 rounded-xl flex-shrink-0 border border-outline-variant/40">
                <span className="text-xs text-on-surface-variant">Forzar registro de variante</span>
                <Toggle checked={forceVariant} onChange={setForceVariant} />
              </div>
            </div>

            {/* Search input */}
            <div className="flex items-center gap-2 border border-outline-variant rounded-xl px-3 py-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <Icon name="calendar_today" size={16} className="text-on-surface-variant" />
              <span className="flex-1 text-sm">{searchValue || 'Buscar producto por código...'}</span>
              {searchValue && (
                <button onClick={() => setSearchValue('')}><Icon name="close" size={15} className="text-on-surface-variant hover:text-error" /></button>
              )}
              <button onClick={() => setSearchOpen(true)} className="text-primary"><Icon name="search" size={17} /></button>
            </div>

            {/* Product results list */}
            <div className="space-y-2">
              {PRODUCTS.slice(0, 2).map((p, i) => (
                <button key={p.code}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${i === 0 ? 'border-primary bg-primary/5' : 'border-outline-variant/30 hover:bg-surface-container'}`}
                  onClick={() => setSearchValue(`${p.code} - ${p.name}`)}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${i === 0 ? 'bg-primary' : 'bg-outline'}`}>
                    <Icon name="inventory_2" size={20} className={i === 0 ? 'text-white' : 'text-surface'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{p.name}</p>
                    <p className="text-xs text-on-surface-variant truncate">Código: {p.code} • Tipo: {p.type}</p>
                  </div>
                  <Icon name="chevron_right" size={16} className="text-on-surface-variant flex-shrink-0" />
                </button>
              ))}
            </div>
          </Card>

          {/* Region + Variant */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="public" size={16} className="text-primary" />
                <p className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">Región</p>
              </div>
              <Select value={region} options={[{ value: 'Guatemala', label: 'Guatemala' }, { value: 'El Salvador', label: 'El Salvador' }, { value: 'Honduras', label: 'Honduras' }]} onChange={e => setRegion(e.target.value)} />
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="layers" size={16} className="text-primary" />
                <p className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">Variante</p>
              </div>
              <Select value={variant} options={[{ value: 'HB-000001-14 - G / 200 LT', label: 'HB-000001-14 - G / 200 LT' }, { value: 'HB-000001-15 - G / 100 LT', label: 'HB-000001-15 - G / 100 LT' }]} onChange={e => setVariant(e.target.value)} />
            </Card>
          </div>

          {/* Trend + Promo */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="col-span-2 p-5">
              <h4 className="text-sm font-bold flex items-center gap-2 mb-4">
                <Icon name="trending_up" size={18} className="text-primary" />
                Tendencia de Rotación
              </h4>
              <div className="flex items-end gap-3">
                <div className="flex-1 h-24 flex items-end gap-1.5 bg-surface-container/40 rounded-lg p-2">
                  {BAR_DATA.map((h, i) => (
                    <div key={i} className="flex-1 rounded-t bg-primary transition-all" style={{ height: `${h * 100}%`, opacity: 0.2 + h * 0.6 }} />
                  ))}
                </div>
                <div className="text-center flex-shrink-0">
                  <p className="text-2xl font-black text-primary">+12%</p>
                  <p className="text-xs text-on-surface-variant">Este mes</p>
                </div>
              </div>
            </Card>
            <Card className="bg-primary p-4 flex flex-col justify-center relative overflow-hidden">
              <Icon name="agriculture" size={80} className="absolute -right-3 -bottom-3 text-white/10" />
              <p className="text-sm font-extrabold text-white relative z-10">Optimiza tus Pedidos</p>
              <p className="text-xs text-white/70 mt-1 relative z-10">Recibe alertas cuando el stock sea bajo.</p>
            </Card>
          </div>
        </div>

        {/* Right — inventory status card */}
        <div className="lg:col-span-4">
          <div className="sticky top-5">
            <Card className={`p-6 border-2 ${cfg.border}`}>
              <div className="flex items-start justify-between mb-6">
                <h3 className="text-lg font-extrabold leading-snug">Detalle de<br />Inventario</h3>
                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${cfg.badge}`}>{cfg.label}</span>
              </div>
              {[{ label: 'Sitio', value: 'FA' }, { label: 'Almacén', value: '115' }].map(r => (
                <div key={r.label} className="flex justify-between py-3 border-b border-outline-variant/20">
                  <span className="text-sm text-on-surface-variant">{r.label}</span>
                  <span className="text-sm font-bold">{r.value}</span>
                </div>
              ))}
              <div className="pt-5 text-center">
                <p className="text-sm text-on-surface-variant mb-1">Física disponible</p>
                <p className={`text-5xl font-black ${cfg.valueColor}`}>0.0</p>
                <p className="text-xs text-on-surface-variant mt-1">Unidades en este almacén</p>
              </div>
              <button className="w-full mt-6 py-3 bg-primary text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors">
                <Icon name="add_shopping_cart" size={17} /> Reservar Stock
              </button>
            </Card>
          </div>
        </div>
      </div>

      <ProductSearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={p => setSearchValue(`${p.code} - ${p.name}`)} />
    </div>
  );
};

export default InventoryPage;

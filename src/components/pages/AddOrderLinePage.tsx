import React, { useState } from 'react';
import { BottomSheet, Card, Icon, Toggle } from '../ui';

interface Product { code: string; name: string; type: string; }
const PRODUCTS: Product[] = [
  { code: 'LQ-000001', name: 'ABAFOR 1.8 EC', type: 'MasterProduct' },
  { code: 'HB-000001', name: 'ACETOFOR 90 EC', type: 'MasterProduct' },
];

interface AddOrderLinePageProps { onAdd?: () => void; onBack?: () => void; }

const AddOrderLinePage: React.FC<AddOrderLinePageProps> = ({ onAdd, onBack }) => {
  const [searchValue, setSearchValue] = useState('LQ-000001 - ABAFOR 1.8 EC');
  const [forceRecord, setForceRecord] = useState(false);
  const [variant, setVariant] = useState('LQ-000001-01');
  const [specialBonus, setSpecialBonus] = useState(false);
  const [quantity, setQuantity] = useState('25');
  const [price, setPrice] = useState('25');
  const [suggestedBonus, setSuggestedBonus] = useState(false);

  // Inventory detail — "Disponible" state
  const inventoryStatus = 'available'; // 'available' | 'out_of_stock'

  return (
    <div className="space-y-3 pb-24">
      <h1 className="text-base font-bold hidden md:block">Agregar Líneas</h1>

      {/* Product search */}
      <div>
        <p className="text-xs text-on-surface-variant mb-1">Codigo de artículo - Descripción</p>
        <div className="flex items-center gap-2 border border-outline-variant rounded-lg px-3 py-2 bg-white">
          <span className="text-sm flex-1">{searchValue}</span>
          <button onClick={() => setSearchValue('')}><Icon name="close" size={14} className="text-on-surface-variant" /></button>
          <Icon name="search" size={15} className="text-primary" />
        </div>
      </div>

      {/* Force record toggle */}
      <div className="flex justify-end">
        <div className="flex items-center gap-2 border border-outline-variant rounded-lg px-3 py-2 bg-white">
          <span className="text-xs text-on-surface-variant">Forzar registro</span>
          <Toggle checked={forceRecord} onChange={setForceRecord} />
        </div>
      </div>

      {/* Variant select */}
      <div>
        <p className="text-xs text-on-surface-variant mb-1">Seleccione la variante del producto</p>
        <div className="border border-outline-variant rounded-lg px-3 py-2.5 bg-white relative">
          <p className="text-[10px] text-on-surface-variant absolute -top-2.5 left-2 bg-white px-1">Seleccionar variante</p>
          <div className="flex items-center justify-between">
            <span className="text-sm">{variant}</span>
            <Icon name="arrow_drop_down" size={18} className="text-on-surface-variant" />
          </div>
        </div>
      </div>

      {/* Inventory detail */}
      <Card className={`p-3 border-2 ${inventoryStatus === 'available' ? 'border-primary/30' : 'border-red-200'}`}>
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-sm font-extrabold">Detalle de<br />Inventario</h3>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${inventoryStatus === 'available' ? 'bg-primary text-white' : 'bg-red-500 text-white'}`}>
            {inventoryStatus === 'available' ? 'Disponible' : 'Sin Stock'}
          </span>
        </div>
        {[
          { label: 'Sitio:', value: 'FA' },
          { label: 'Almacén:', value: '115' },
        ].map(row => (
          <div key={row.label} className="flex justify-between py-1.5 border-b border-outline-variant/20">
            <span className="text-xs text-on-surface-variant">{row.label}</span>
            <span className="text-xs font-semibold">{row.value}</span>
          </div>
        ))}
        <div className="pt-2 flex justify-between">
          <span className="text-xs text-on-surface-variant font-medium">Física disponible</span>
          <span className={`text-sm font-black ${inventoryStatus === 'available' ? 'text-on-surface' : 'text-red-500'}`}>
            {inventoryStatus === 'available' ? '8044.0' : '0.0'}
          </span>
        </div>
      </Card>

      {/* Site banner */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/8 border border-primary/20 rounded-xl">
        <Icon name="warehouse" size={15} className="text-primary" />
        <span className="text-xs font-bold text-primary">Sitio: FA | Almacén: 115</span>
      </div>

      {/* Special bonus toggle */}
      <div className="flex items-center justify-between border border-outline-variant rounded-lg px-3 py-2.5 bg-white">
        <span className="text-sm text-on-surface-variant">Bonificación Especial</span>
        <Toggle checked={specialBonus} onChange={setSpecialBonus} />
      </div>

      {/* Quantity */}
      <div className="border border-outline-variant rounded-lg px-3 pt-1 pb-2 bg-white relative">
        <p className="text-[10px] text-on-surface-variant">Cantidad</p>
        <input
          type="number"
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          className="w-full text-sm font-semibold focus:outline-none mt-0.5"
        />
      </div>

      {/* Admin warning */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
        <Icon name="warning" size={14} className="text-amber-600" />
        <p className="text-xs text-amber-700 font-medium">Comunicarse con el Administrador</p>
      </div>

      {/* Price */}
      <div className="border border-outline-variant rounded-lg px-3 pt-1 pb-2 bg-white relative">
        <p className="text-[10px] text-on-surface-variant">Precio</p>
        <input
          type="number"
          value={price}
          onChange={e => setPrice(e.target.value)}
          className="w-full text-sm font-semibold focus:outline-none mt-0.5"
        />
      </div>

      {/* Exchange rate (disabled) */}
      <div className="border border-outline-variant rounded-lg px-3 pt-1 pb-2 bg-surface-container-low relative">
        <p className="text-[10px] text-on-surface-variant">Tipo de cambio</p>
        <input value="1.00" disabled className="w-full text-sm text-on-surface-variant bg-transparent focus:outline-none mt-0.5" />
      </div>

      {/* Suggested bonus toggle */}
      <div className="flex items-center justify-between border border-outline-variant rounded-lg px-3 py-2.5 bg-white">
        <span className="text-sm text-on-surface-variant">Bonificación sugerida</span>
        <Toggle checked={suggestedBonus} onChange={setSuggestedBonus} />
      </div>

      {/* Submit button */}
      <button
        onClick={onAdd}
        className="fixed bottom-0 left-0 right-0 md:relative md:bottom-auto bg-primary text-white py-4 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors md:rounded-xl"
      >
        Agregar línea
      </button>
    </div>
  );
};

export default AddOrderLinePage;

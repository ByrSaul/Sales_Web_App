import React from 'react';
import { Badge, Button, Card, Icon } from '../ui';

interface ProductLine { sku: string; name: string; category: string; quantity: number; unitPrice: number; subtotal: number; }

const MOCK_LINES: ProductLine[] = [
  { sku: 'FERT-992', name: 'Fertilizante Nitrogenado Pro 50kg', category: 'Nutrición Vegetal',    quantity: 10,  unitPrice: 450, subtotal: 4500  },
  { sku: 'HERB-410', name: 'Herbicida Selectivo Ultra',         category: 'Protección de Cultivos',quantity: 5,   unitPrice: 225, subtotal: 1125  },
  { sku: 'SEMT-012', name: 'Semilla de Banano Cavendish Premium',category: 'Semillas',             quantity: 100, unitPrice: 85,  subtotal: 8500  },
];

interface OrderDetailPageProps { onBack?: () => void; }

const OrderDetailPage: React.FC<OrderDetailPageProps> = ({ onBack }) => (
  <div className="space-y-3">
    {/* Breadcrumb */}
    <nav className="flex items-center gap-1 text-xs text-on-surface-variant">
      <button onClick={onBack} className="flex items-center gap-1 hover:text-primary">
        <Icon name="arrow_back" size={13} /> Volver a Pedidos
      </button>
      <Icon name="chevron_right" size={11} />
      <span className="text-on-surface">Detalle de Pedido</span>
    </nav>

    {/* Main card */}
    <Card className="p-3">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-extrabold">OV-083100</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold">FACTURADO</span>
          </div>
          <p className="text-sm font-bold text-primary mt-1">COMPAÑÍA DE DESARROLLO BANANERO DE GUATEMALA, S.A.</p>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1"><Icon name="calendar_today" size={11} />24 May, 2024</span>
            <span className="flex items-center gap-1"><Icon name="location_on" size={11} />Planta Central</span>
            <span className="flex items-center gap-1"><Icon name="person" size={11} />Carlos Mendoza</span>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button className="flex items-center gap-1 px-2.5 py-1.5 border border-outline-variant rounded-lg text-xs hover:bg-surface-container"><Icon name="attach_file" size={12} />Adjuntar</button>
          <button className="flex items-center gap-1 px-2.5 py-1.5 border border-outline-variant rounded-lg text-xs hover:bg-surface-container"><Icon name="print" size={12} />Imprimir</button>
          <button className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-white rounded-lg text-xs"><Icon name="download" size={12} />Descargar PDF</button>
        </div>
      </div>

      {/* Status info */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: 'credit_card', label: 'Gestión de Crédito', value: '30 Días Crédito', bg: 'bg-amber-50' },
          { icon: 'local_shipping', label: 'Estado de Envío',  value: 'Entregado',       bg: 'bg-primary/5' },
        ].map(c => (
          <div key={c.label} className={`flex items-center gap-2.5 p-2.5 rounded-xl ${c.bg}`}>
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <Icon name={c.icon} size={15} className="text-on-surface-variant" />
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant">{c.label}</p>
              <p className="text-xs font-bold">{c.value}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>

    {/* Product lines */}
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-outline-variant/30">
        <h2 className="text-sm font-bold">Líneas de Producto</h2>
        <span className="text-xs px-2 py-0.5 bg-surface-container rounded-full text-on-surface-variant">{MOCK_LINES.length} ítems</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-on-surface-variant uppercase text-[10px] tracking-wide border-b border-outline-variant/30">
              <th className="py-2 px-3">SKU</th>
              <th className="py-2 px-3">Producto</th>
              <th className="py-2 px-3 text-center">Cant.</th>
              <th className="py-2 px-3 text-right">P.Unit.</th>
              <th className="py-2 px-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_LINES.map(line => (
              <tr key={line.sku} className="border-t border-outline-variant/20 hover:bg-surface-container/50">
                <td className="py-2.5 px-3 font-bold text-primary">{line.sku}</td>
                <td className="py-2.5 px-3">
                  <p className="font-semibold">{line.name}</p>
                  <p className="text-on-surface-variant text-[10px]">{line.category}</p>
                </td>
                <td className="py-2.5 px-3 text-center">{line.quantity}</td>
                <td className="py-2.5 px-3 text-right">Q {line.unitPrice.toLocaleString()}</td>
                <td className="py-2.5 px-3 text-right font-bold">Q {line.subtotal.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>

    {/* Bottom: Notes + Summary */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Card className="p-3">
        <h2 className="text-sm font-bold mb-2">Notas y Observaciones</h2>
        <p className="text-xs text-on-surface-variant italic leading-relaxed">
          "Entrega prioritaria solicitada para el día jueves antes de las 10:00 AM en el patio de maniobras sur."
        </p>
      </Card>

      <Card className="p-3 bg-primary">
        <h3 className="text-sm font-bold text-white mb-2">Resumen de Pago</h3>
        <div className="space-y-1.5 text-xs">
          {[['Subtotal', 'Q 14,125.00'], ['Impuestos (IVA 12%)', 'Q 1,695.00'], ['Desc. Corporativo', '- Q 500.00']].map(([l, v]) => (
            <div key={l} className="flex justify-between text-white/80"><span>{l}</span><span>{v}</span></div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-white/20">
          <Icon name="payments" size={20} className="text-white" />
          <div>
            <p className="text-[10px] text-white/60 uppercase">Total Final</p>
            <p className="text-xl font-black text-white">15,320.00</p>
          </div>
        </div>
        <button className="w-full mt-3 py-2 border border-white/40 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1 hover:bg-white/10">
          <Icon name="send" size={13} /> Enviar por Correo
        </button>
      </Card>
    </div>

    {/* Billing */}
    <Card className="p-3">
      <h3 className="text-sm font-bold mb-2">Información de Facturación</h3>
      <div className="space-y-1.5 text-xs">
        <div><p className="text-on-surface-variant">NIT</p><p className="font-bold mt-0.5">1234567-8</p></div>
        <div><p className="text-on-surface-variant uppercase text-[10px]">Dirección Fiscal</p><p className="mt-0.5">Diagonal 6, 10-01 Zona 10, Edificio Las Margaritas, Ciudad de Guatemala</p></div>
      </div>
      <button className="mt-2 flex items-center gap-1 text-xs text-primary font-medium border border-outline-variant rounded-lg px-2.5 py-1.5 hover:bg-surface-container">
        <Icon name="edit" size={12} /> Editar Datos Fiscales
      </button>
    </Card>
  </div>
);

export default OrderDetailPage;

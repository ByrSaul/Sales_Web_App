import React from 'react';
import { Card, Icon } from '../ui';
import AgricultureIcon from '@mui/icons-material/Agriculture';

const ACTIVITY = [
  {
    icon: 'shopping_cart',
    iconBg: 'bg-primary/10 text-primary',
    title: 'Pedido #4529 - Agromás S.A.',
    sub: 'Creado hace 2 horas • $12,450.00',
  },
  {
    icon: 'person_add',
    iconBg: 'bg-blue-50 text-blue-600',
    title: 'Nuevo Cliente: Finca Santa Rosa',
    sub: 'Registrado hoy a las 09:15 AM',
  },
  {
    icon: 'receipt',
    iconBg: 'bg-red-50 text-error',
    title: 'Factura generada: F001-923',
    sub: 'Pendiente de envío a cliente',
  },
];
const QUICK = [
  { icon: 'inventory_2', label: 'Stock Crítico' },
  { icon: 'map', label: 'Ruta de Hoy' },
  { icon: 'bar_chart', label: 'Reportes' },
  { icon: 'headset_mic', label: 'Soporte' },
];

const DashboardPage: React.FC = () => (
  <div className="space-y-5">
    {/* Hero banner */}
    <Card className="relative overflow-hidden border-0 p-8 bg-gradient-to-r from-primary to-primary-container">
      {/* Círculo decorativo */}
      <div className="absolute right-[-100px] top-[-50px] w-[400px] h-[400px] rounded-full bg-white/10" />
      <span
        className="material-symbols-outlined absolute -right-4 -top-4 text-[140px] text-white/10 select-none"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        eco
      </span>

      <div className="flex items-center gap-2 mb-2">
        <AgricultureIcon
          sx={{
            color: 'white',
            fontSize: 20,
          }}
        />
        <p className="text-xs text-white/60 uppercase tracking-widest font-bold">
          PLATAFORMA AGROGESTION
        </p>
      </div>
      <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-2">
        Bienvenido a Agrofortress.
      </h1>
      <p className="text-sm text-white/75 mb-5 max-w-lg">
        Tu herramienta de gestión agrícola. Resumen general de las operaciones de hoy.
      </p>
      <div className="flex gap-3">
        <button className="flex items-center gap-1.5 px-4 py-2 border border-white/40 text-white rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">
          <Icon name="add_circle" size={15} /> Nuevo Pedido
        </button>
        <button className="flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">
          Ver Catálogo
        </button>
      </div>
    </Card>

    {/* Main grid */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left — stats + activity */}
      <div className="lg:col-span-8 space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              label: 'PEDIDOS HOY',
              value: '12',
              trend: '+8% vs ayer',
              color: 'text-primary',
              icon: 'shopping_basket',
              up: true,
            },
            {
              label: 'PEDIDOS FINALIZADOS',
              value: '134',
              trend: 'Mes en curso',
              color: 'text-secondary',
              icon: 'check_circle',
              up: true,
            },
          ].map((s) => (
            <Card key={s.label} className="p-4 md:p-5">
              <div className="flex items-start justify-between">
                <p className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">
                  {s.label}
                </p>
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.up ? 'bg-primary/10' : 'bg-secondary/10'}`}
                >
                  <Icon name={s.icon} size={18} className={s.color} />
                </div>
              </div>
              <p className={`text-4xl font-black ${s.color} mt-2 leading-none`}>{s.value}</p>
              <p
                className={`text-xs ${s.up ? 'text-primary' : 'text-secondary'} flex items-center gap-1 mt-2`}
              >
                <Icon name="trending_up" size={13} />
                {s.trend}
              </p>
            </Card>
          ))}
        </div>

        {/* Activity */}
        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold">Actividad Reciente</h2>
            <button className="text-sm text-primary font-semibold hover:underline">Ver todo</button>
          </div>
          <div className="divide-y divide-outline-variant/30">
            {ACTIVITY.map((item, i) => (
              <button
                key={i}
                className="w-full flex items-center gap-3 py-3 hover:bg-surface-container/60 transition-colors rounded-lg px-2 text-left group"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${item.iconBg}`}
                >
                  <Icon name={item.icon} size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{item.title}</p>
                  <p className="text-xs text-on-surface-variant truncate">{item.sub}</p>
                </div>
                <Icon
                  name="chevron_right"
                  size={16}
                  className="text-on-surface-variant group-hover:text-primary transition-colors flex-shrink-0"
                />
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Right — featured client + quick actions */}
      <div className="lg:col-span-4 space-y-4">
        <Card className="overflow-hidden">
          <div className="h-32 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center relative">
            <Icon name="landscape" size={56} className="text-primary/20" />
            <div className="absolute top-2 left-2 flex gap-1">
              <span className="px-2 py-0.5 bg-secondary text-white rounded text-xs font-bold">
                CLIENTE
              </span>
              <span className="px-2 py-0.5 bg-error text-white rounded text-xs font-bold">TOP</span>
            </div>
          </div>
          <div className="p-4">
            <h3 className="text-base font-bold">Hacienda El Porvenir</h3>
            <p className="text-sm text-on-surface-variant mt-1">
              Último pedido hace 2 días. Requiere seguimiento de fertilizantes.
            </p>
            <button className="w-full mt-3 py-2 border border-outline-variant rounded-lg text-sm font-medium hover:bg-surface-container transition-colors">
              Ver Perfil Cliente
            </button>
          </div>
        </Card>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          {QUICK.map((q) => (
            <button
              key={q.label}
              className="flex flex-col items-center gap-2 p-4 bg-white border border-outline-variant rounded-xl hover:border-primary hover:bg-primary/5 transition-all group"
            >
              <Icon
                name={q.icon}
                size={24}
                className="text-on-surface-variant group-hover:text-primary transition-colors"
              />
              <span className="text-xs text-on-surface-variant group-hover:text-primary font-medium text-center">
                {q.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>

    <p className="text-center text-xs text-on-surface-variant/50 pb-2">VERSIÓN 1.0.2-38 · DEV</p>
  </div>
);

export default DashboardPage;

import type { ExistingOrder } from '../../orders/orderTypes';
import { statusLabel } from '../../orders/orderMappers';
import { Card, Icon } from '../../../components/ui';

type Props = {
  orders: ExistingOrder[];
  loading: boolean;
  error: boolean;
  onOpenOrder: (salesOrderNumber: string) => void;
  onOpenAll: () => void;
};

const amount = (order: ExistingOrder) =>
  `${order.currencyCode || '—'} ${new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(order.salesAmount)}`;

/** Presenta pedidos recientes con estados de carga, error y navegación. */
export const RecentActivityCard = ({
  orders,
  loading,
  error,
  onOpenOrder,
  onOpenAll,
}: Props) => (
  <Card className="min-h-64 p-4 md:p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-bold">Actividad reciente</h2>
      <button
        type="button"
        className="text-sm font-semibold text-primary hover:underline"
        onClick={onOpenAll}
      >
        Ver todo
      </button>
    </div>
    {loading && <p className="text-sm text-on-surface-variant">Cargando...</p>}
    {error && <p className="text-sm text-on-surface-variant">No disponible</p>}
    {!loading && !error && orders.length === 0 && (
      <p className="text-sm text-on-surface-variant">No hay pedidos recientes.</p>
    )}
    <div className="divide-y divide-outline-variant/30">
      {orders.slice(0, 3).map((order) => (
        <button
          key={order.salesOrderNumber}
          type="button"
          className="group flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-surface-container/60"
          onClick={() => onOpenOrder(order.salesOrderNumber)}
        >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon name="shopping_cart" size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Pedido {order.salesOrderNumber}</p>
            <p className="truncate text-xs text-on-surface-variant">
              {order.customerAccount} · {order.customerName || 'Cliente sin nombre'}
            </p>
            <p className="truncate text-xs text-on-surface-variant">
              {statusLabel(order.status)} · {order.createdDate || 'Fecha no disponible'} ·{' '}
              {amount(order)}
            </p>
          </div>
          <Icon
            name="chevron_right"
            size={16}
            className="flex-shrink-0 text-on-surface-variant transition-colors group-hover:text-primary"
          />
        </button>
      ))}
    </div>
  </Card>
);

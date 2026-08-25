import { useNavigate } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { DashboardHero } from '../../features/dashboard/components/DashboardHero';
import { DashboardHighlightCard } from '../../features/dashboard/components/DashboardHighlightCard';
import { DashboardMetricCard } from '../../features/dashboard/components/DashboardMetricCard';
import {
  QuickActionsCard,
  type DashboardQuickAction,
} from '../../features/dashboard/components/QuickActionsCard';
import { RecentActivityCard } from '../../features/dashboard/components/RecentActivityCard';
import { useDashboardData } from '../../features/dashboard/dashboardQueries';

const QUICK_ACTIONS: DashboardQuickAction[] = [
  { icon: 'inventory_2', label: 'Consulta de inventario', route: '/inventario' },
  { icon: 'description', label: 'Facturas de venta', route: '/facturas' },
  { icon: 'account_balance_wallet', label: 'Estado de cuenta', route: '/estado-cuenta' },
  { icon: 'headset_mic', label: 'Soporte técnico', route: '/soporte' },
];

/**
 * Pantalla inicial que presenta métricas, actividad y accesos rápidos reales.
 *
 * Dependencias:
 * - Contexto de sesión.
 * - `useDashboardData`.
 * - Componentes visuales del Dashboard.
 */
const DashboardPage = () => {
  const navigate = useNavigate();
  const { context } = useSession();
  const dashboard = useDashboardData();
  const userName = context.user?.name.trim() || context.user?.id.trim() || 'Usuario';

  return (
    <div className="space-y-5 overflow-x-hidden">
      <DashboardHero
        userName={userName}
        onNewOrder={() => navigate('/crear-pedido')}
        onOrders={() => navigate('/pedidos')}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DashboardMetricCard
              label="Pedidos de hoy"
              icon="shopping_basket"
              value={dashboard.today.data?.pagination.totalRecords}
              loading={dashboard.today.isPending}
              error={dashboard.today.isError}
            />
            <DashboardMetricCard
              label="Pedidos abiertos"
              icon="pending_actions"
              value={dashboard.open.data?.pagination.totalRecords}
              loading={dashboard.open.isPending}
              error={dashboard.open.isError}
              accent="secondary"
            />
          </div>

          <RecentActivityCard
            orders={dashboard.recent.data?.items ?? []}
            loading={dashboard.recent.isPending}
            error={dashboard.recent.isError}
            onOpenAll={() => navigate('/pedidos')}
            onOpenOrder={(salesOrderNumber) =>
              navigate(`/pedidos/${encodeURIComponent(salesOrderNumber)}`)
            }
          />
        </div>

        <div className="space-y-4 lg:col-span-4">
          <DashboardHighlightCard
            value={dashboard.customers.data?.pagination.totalRecords}
            loading={dashboard.customers.isPending}
            error={dashboard.customers.isError}
            onOpen={() => navigate('/clientes')}
          />
          <QuickActionsCard actions={QUICK_ACTIONS} onNavigate={navigate} />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

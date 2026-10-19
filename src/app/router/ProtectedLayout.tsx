import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useSafeNavigate as useNavigate } from '../../core/hooks/useSafeNavigate';
import { useAuth } from '../providers/AuthProvider';
import { useSession } from '../providers/SessionProvider';
import AppLayout from '../../components/layout/AppLayout';
const titles: Record<string, string> = {
  '/pedidos': 'Mis Pedidos',
  '/clientes': 'Mis Clientes',
  '/inventario': 'Consulta de Inventario',
  '/facturas': 'Mis facturas de venta',
  '/crear-pedido': 'Crear pedido',
  '/estado-cuenta': 'Estado de Cuenta',
};
const activeRoute = (pathname: string): string => {
  if (pathname.startsWith('/pedidos')) return '/pedidos';
  if (pathname.startsWith('/crear-pedido')) return '/crear-pedido';
  return pathname;
};
/** Compone el layout autenticado y presenta advertencias del contexto operativo. */
const ProtectedLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { account } = useAuth();
  const { context } = useSession();
  const active = activeRoute(location.pathname);
  return (
    <>
      <AppLayout
        activeRoute={active}
        user={{ name: context.vendor?.name ?? account?.name ?? '', role: account?.username ?? '' }}
        pageTitle={titles[active]}
        onNavigate={navigate}
        onBack={location.pathname !== '/home' ? () => navigate(-1) : undefined}
        showFab={location.pathname === '/home' || location.pathname === '/pedidos'}
        onFab={() => navigate('/crear-pedido')}
      >
        <Outlet />
      </AppLayout>
      {context.warning && (
        <output
          aria-live="polite" aria-atomic="true"
          className="block fixed bottom-4 left-4 right-4 md:left-auto md:max-w-lg z-50 bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-lg text-xs shadow"
        >
          {context.warning}
        </output>
      )}
    </>
  );
};
export default ProtectedLayout;

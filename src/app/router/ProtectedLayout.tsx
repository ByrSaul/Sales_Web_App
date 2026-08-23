import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { useSession } from '../providers/SessionProvider';
import AppLayout from '../../components/layout/AppLayout';
const titles: Record<string, string> = { '/pedidos': 'Mis Pedidos', '/clientes': 'Mis Clientes', '/inventario': 'Consulta de Inventario', '/facturas': 'Mis facturas de venta', '/crear-pedido': 'Crear pedido', '/estado-cuenta': 'Estado de Cuenta' };
const ProtectedLayout: React.FC = () => { const location = useLocation(); const navigate = useNavigate(); const { account } = useAuth(); const { context } = useSession(); const active = location.pathname.startsWith('/pedidos') ? '/pedidos' : location.pathname.startsWith('/crear-pedido') ? '/crear-pedido' : location.pathname; return <><AppLayout activeRoute={active} user={{ name: context.vendor?.name ?? account?.name ?? '', role: account?.username ?? '' }} pageTitle={titles[active]} onNavigate={navigate} onBack={location.pathname !== '/home' ? () => navigate(-1) : undefined} showFab={location.pathname === '/home' || location.pathname === '/pedidos'} onFab={() => navigate('/crear-pedido')}><Outlet /></AppLayout>{context.warning && <div role="status" className="fixed bottom-4 left-4 right-4 md:left-auto md:max-w-lg z-50 bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-lg text-xs shadow">{context.warning}</div>}</>; };
export default ProtectedLayout;

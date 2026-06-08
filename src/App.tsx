import React, { useState } from 'react';
import AppLayout from './components/layout/AppLayout';
import DashboardPage       from './components/pages/DashboardPage';
import OrdersPage          from './components/pages/OrdersPage';
import OrderDetailPage     from './components/pages/OrderDetailPage';
import ClientsPage         from './components/pages/ClientsPage';
import InventoryPage       from './components/pages/InventoryPage';
import InvoicesPage        from './components/pages/InvoicesPage';
import CreateOrderPage     from './components/pages/CreateOrderPage';
import AddOrderLinePage    from './components/pages/AddOrderLinePage';
import AccountStatementPage from './components/pages/AccountStatementPage';
import CompanySelectPage   from './components/pages/CompanySelectPage';
import VendorSelectPage    from './components/pages/VendorSelectPage';
import { User } from './types';

type Route =
  | '/' | '/pedidos' | '/pedidos/detalle' | '/clientes' | '/inventario'
  | '/facturas' | '/facturas/busqueda' | '/crear-pedido' | '/crear-pedido/linea'
  | '/estado-cuenta' | '/empresas' | '/vendedores' | '/soporte';

const PAGE_TITLES: Partial<Record<Route, string>> = {
  '/pedidos':           'Mis Pedidos',
  '/pedidos/detalle':   'Detalle de Pedido',
  '/clientes':          'Mis Clientes',
  '/inventario':        'Consulta de Inventario',
  '/facturas':          'Mis facturas de venta',
  '/facturas/busqueda': 'Consultar facturas de ...',
  '/crear-pedido':      'Crear pedido',
  '/crear-pedido/linea':'Agregar Líneas',
  '/estado-cuenta':     'Estado de Cuenta',
  '/empresas':          'Cambiar Empresa',
  '/vendedores':        'Seleccionar Vendedor',
};

const SEARCH_PH: Partial<Record<Route, string>> = {
  '/':               'Buscar pedidos o clientes...',
  '/pedidos':        'Buscar pedido por número o cliente...',
  '/clientes':       'Buscar por cuenta o nombre...',
  '/inventario':     'Buscar global...',
  '/facturas':       'Buscar facturas...',
};

const USER: User = { name: 'Byron Chacón', role: 'bmarroquin@foragro.com' };

// Routes that don't use the main sidebar layout
const STANDALONE_ROUTES: Route[] = ['/empresas', '/vendedores'];

const App: React.FC = () => {
  const [route, setRoute] = useState<Route>('/');
  const [history, setHistory] = useState<Route[]>([]);

  const navigate = (to: Route) => {
    setHistory(h => [...h, route]);
    setRoute(to);
  };

  const goBack = () => {
    const prev = history[history.length - 1];
    if (prev) { setRoute(prev); setHistory(h => h.slice(0, -1)); }
    else setRoute('/');
  };

  const handleNav = (href: string) => navigate(href as Route);

  // Determine sidebar active (detail pages highlight parent)
  const sidebarRoute = route === '/pedidos/detalle' ? '/pedidos'
    : route === '/estado-cuenta' ? '/clientes'
    : route === '/crear-pedido/linea' ? '/crear-pedido'
    : route === '/facturas/busqueda' ? '/facturas'
    : route;

  const hasBack = history.length > 0 && route !== '/';
  const isStandalone = STANDALONE_ROUTES.includes(route);

  const renderPage = () => {
    switch (route) {
      case '/':                  return <DashboardPage />;
      case '/pedidos':           return <OrdersPage onViewOrder={() => navigate('/pedidos/detalle')} />;
      case '/pedidos/detalle':   return <OrderDetailPage onBack={goBack} />;
      case '/clientes':          return <ClientsPage onEstadoCuenta={() => navigate('/estado-cuenta')} />;
      case '/inventario':        return <InventoryPage />;
      case '/facturas':          return <InvoicesPage />;
      case '/facturas/busqueda': return <InvoicesPage showSearch />;
      case '/crear-pedido':      return <CreateOrderPage onNext={() => navigate('/crear-pedido/linea')} />;
      case '/crear-pedido/linea':return <AddOrderLinePage onAdd={goBack} onBack={goBack} />;
      case '/estado-cuenta':     return <AccountStatementPage />;
      case '/empresas':          return <CompanySelectPage onSelect={() => navigate('/vendedores')} />;
      case '/vendedores':        return <VendorSelectPage onSelect={() => navigate('/')} />;
      default:                   return <DashboardPage />;
    }
  };

  // Standalone pages (no sidebar)
  if (isStandalone) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <div className="bg-primary text-white flex items-center gap-3 px-4 py-3">
          {hasBack && (
            <button onClick={goBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20">
              <span className="material-symbols-outlined text-white" style={{ fontSize: 18 }}>arrow_back</span>
            </button>
          )}
          <h1 className="text-sm font-semibold">{PAGE_TITLES[route] ?? ''}</h1>
        </div>
        {renderPage()}
      </div>
    );
  }

  return (
    <AppLayout
      activeRoute={sidebarRoute}
      user={USER}
      searchPlaceholder={SEARCH_PH[route]}
      onNavigate={handleNav}
      onBack={hasBack ? goBack : undefined}
      showFab={route === '/pedidos' || route === '/'}
      onFab={() => navigate('/crear-pedido')}
    >
      {renderPage()}
    </AppLayout>
  );
};

export default App;

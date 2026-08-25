import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { User } from '../../types';
import { Icon } from '../ui';

interface AppLayoutProps {
  children: React.ReactNode;
  activeRoute: string;
  user: User;
  searchPlaceholder?: string;
  pageTitle?: string;
  onNavigate: (href: string) => void;
  onSearch?: (q: string) => void;
  onBack?: () => void;
  showFab?: boolean;
  onFab?: () => void;
}

const BOTTOM_NAV = [
  { label: 'Pedidos', icon: 'receipt_long', href: '/pedidos' },
  { label: 'Clientes', icon: 'group', href: '/clientes' },
  { label: 'Inventario', icon: 'inventory_2', href: '/inventario' },
  { label: 'Facturas', icon: 'description', href: '/facturas' },
];

/**
 * Layout principal de las rutas autenticadas.
 *
 * Responsabilidades:
 * - Componer Sidebar, TopBar, navegación móvil y contenido.
 * - Mantener la apertura del menú móvil.
 * - Presentar la acción flotante cuando corresponde.
 */
const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  activeRoute,
  user,
  searchPlaceholder,
  pageTitle,
  onNavigate,
  onSearch,
  onBack,
  showFab,
  onFab,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Sidebar
        activeRoute={activeRoute}
        user={user}
        onNavigate={onNavigate}
        mobileOpen={drawerOpen}
        onMobileClose={() => setDrawerOpen(false)}
      />
      <TopBar
        user={user}
        searchPlaceholder={searchPlaceholder}
        title={pageTitle}
        onSearch={onSearch}
        onMenuOpen={() => setDrawerOpen(true)}
        onBack={onBack}
      />

      {/* Main content */}
      <main className="md:ml-56 pt-12 min-h-screen pb-16 md:pb-0">
        <div className="p-3 md:p-5 max-w-7xl mx-auto">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-outline-variant flex z-30">
        {BOTTOM_NAV.map((item) => {
          const isActive = activeRoute === item.href;
          return (
            <button
              key={item.href}
              onClick={() => onNavigate(item.href)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}
            >
              <Icon
                name={item.icon}
                size={20}
                fill={isActive}
                className={isActive ? 'text-primary' : ''}
              />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* FAB */}
      {showFab && (
        <button
          onClick={onFab}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-12 h-12 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
        >
          <Icon name="add_shopping_cart" size={22} />
        </button>
      )}
    </div>
  );
};

export default AppLayout;

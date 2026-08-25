import React from 'react';
import { User } from '../../types';
import { Icon } from '../ui';
import { useSession } from '../../app/providers/SessionProvider';
import { appConfig } from '../../app/config/env';

interface SidebarProps {
  activeRoute: string;
  user: User;
  onNavigate: (href: string) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const NAV_ITEMS = [
  { label: 'Mis pedidos de venta', icon: 'receipt_long', href: '/pedidos' },
  { label: 'Mis clientes', icon: 'group', href: '/clientes' },
  { label: 'Consulta de Inventario', icon: 'inventory_2', href: '/inventario' },
  { label: 'Crear pedidos de venta', icon: 'add_shopping_cart', href: '/crear-pedido' },
  { label: 'Facturas de venta', icon: 'description', href: '/facturas' },
  // Producción/Forecast ya están implementados; solo ocultos temporalmente vía feature flag (fail closed).
  ...(appConfig.featureProduction
    ? [{ label: 'Producción', icon: 'factory', href: '/produccion' }]
    : []),
  ...(appConfig.featureForecast
    ? [{ label: 'Forecast de ventas', icon: 'monitoring', href: '/forecast' }]
    : []),
  { label: 'Soporte Técnico', icon: 'headset_mic', href: '/soporte' },
];

const BOTTOM_ITEMS = [
  { label: 'Cambiar Empresa', icon: 'business', href: '/company' },
  { label: 'Cerrar Sesión', icon: 'logout', href: '/logout', danger: true },
];

interface NavLinkProps {
  label: string;
  icon: string;
  href: string;
  isActive: boolean;
  danger?: boolean;
  onClick: () => void;
}
/** Opción reutilizable de navegación para las variantes desktop y móvil. */
const NavLink: React.FC<NavLinkProps> = ({ label, icon, isActive, danger, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm ${
      isActive
        ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary'
        : danger
          ? 'text-error hover:bg-red-50'
          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
    }`}
  >
    <Icon name={icon} size={18} className={isActive ? 'text-primary' : ''} />
    <span>{label}</span>
  </button>
);

/** Navegación lateral principal adaptada a desktop y drawer móvil. */
const Sidebar: React.FC<SidebarProps> = ({
  activeRoute,
  user,
  onNavigate,
  mobileOpen,
  onMobileClose,
}) => {
  const { changeCompany, logout } = useSession();
  const handleNav = (href: string) => {
    onNavigate(href);
    onMobileClose?.();
  };
  const handleBottomNav = (href: string) => {
    onMobileClose?.();
    if (href === '/company') changeCompany();
    else if (href === '/logout') void logout();
  };

  const content = (
    <div className="flex flex-col h-full">
      {/* User header */}
      {/*<div className="bg-primary px-4 py-5">
        <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center mb-2">
          <span className="text-primary font-bold text-sm">{user.name.charAt(0)}</span>
        </div>
        <p className="text-white text-sm font-semibold">Vendedor: {user.name}</p>
        <p className="text-white/70 text-xs">{user.role}</p>
      </div>*/}

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            isActive={activeRoute === item.href}
            onClick={() => handleNav(item.href)}
          />
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-outline-variant space-y-0.5">
        {BOTTOM_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            isActive={false}
            danger={item.danger}
            onClick={() => handleBottomNav(item.href)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 h-screen fixed left-0 top-0 bg-surface border-r border-outline-variant z-40">
        {/* Brand */}
        <div className="px-6 py-3 ">
          <h1 className="text-base font-bold text-primary">AgroGestiones</h1>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">{content}</div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onMobileClose} />
          <div className="relative w-64 bg-surface h-full shadow-xl overflow-y-auto">{content}</div>
        </div>
      )}
    </>
  );
};

export default Sidebar;

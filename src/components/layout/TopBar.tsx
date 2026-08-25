import React from 'react';
import { User } from '../../types';
import { useSession } from '../../app/providers/SessionProvider';
import { Icon } from '../ui';

interface TopBarProps {
  searchPlaceholder?: string;
  user: User;
  onSearch?: (q: string) => void;
  onMenuOpen?: () => void;
  title?: string;
  onBack?: () => void;
}

/**
 * Barra superior con identidad operativa, navegación contextual y notificaciones.
 *
 * Dependencias:
 * - Contexto de sesión para compañía, usuario y vendedor activos.
 */
const TopBar: React.FC<TopBarProps> = ({
  searchPlaceholder = 'Buscar...',
  user,
  onSearch,
  onMenuOpen,
  title,
  onBack,
}) => {
  const { context } = useSession();
  const companyDisplay = context.company?.id.trim() || 'No disponible';
  const userName =
    context.user?.name.trim() || context.user?.id.trim() || user.name.trim() || 'No disponible';
  const vendorName = context.vendor?.name.trim() || context.vendor?.id.trim() || 'No disponible';

  return (
  <header className="fixed top-0 left-0 right-0 z-30 flex h-12 items-center gap-3 overflow-hidden border-b border-outline-variant bg-white px-4 shadow-sm md:left-56">
    {/* Mobile: hamburger or back */}
    <div className="flex md:hidden">
      {onBack ? (
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container"
        >
          <Icon name="arrow_back" size={18} className="text-on-surface-variant" />
        </button>
      ) : (
        <button
          onClick={onMenuOpen}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container"
        >
          <Icon name="menu" size={18} className="text-on-surface-variant" />
        </button>
      )}
    </div>

    {/* Mobile title or search 
    {title ? (
      <h1 className="flex-1 text-sm font-semibold text-on-surface md:hidden">{title}</h1>
    ) : (
      <div className="flex-1 md:max-w-sm">
        <div className="flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-lg border border-outline-variant/60 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <Icon name="search" size={15} className="text-on-surface-variant flex-shrink-0" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="bg-transparent outline-none text-xs text-on-surface placeholder:text-on-surface-variant/60 w-full"
            onChange={e => onSearch?.(e.target.value)}
          />
        </div>
      </div>
    )}*/}

    {/* Desktop search (always shown on md+) 
    <div className="hidden md:flex flex-1 max-w-sm">
      <div className="flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-lg border border-outline-variant/60 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all w-full">
        <Icon name="search" size={15} className="text-on-surface-variant flex-shrink-0" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          className="bg-transparent outline-none text-xs text-on-surface placeholder:text-on-surface-variant/60 w-full"
          onChange={e => onSearch?.(e.target.value)}
        />
      </div>
    </div>*/}

    <div className="ml-auto flex min-w-0 items-center gap-2">
      <button className="relative hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg hover:bg-surface-container sm:flex">
        <Icon name="notifications" size={18} className="text-on-surface-variant" />
        <span className="absolute top-1 right-1.5 w-1.5 h-1.5 bg-error rounded-full" />
      </button>
      <div className="flex min-w-0 items-center gap-2 border-l border-outline-variant pl-2 md:pl-3">
        <div className="min-w-0 text-right text-[9px] leading-tight text-on-surface-variant md:text-[10px]">
          <p className="truncate"><span className="font-medium">Empresa:</span> {companyDisplay}</p>
          <p className="truncate text-on-surface"><span className="font-medium">Usuario:</span> {userName}</p>
          <p className="truncate"><span className="font-medium">Vendedor:</span> {vendorName}</p>
        </div>
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary">
          <span className="text-xs font-bold text-white">{userName.charAt(0)}</span>
        </div>
      </div>
    </div>
  </header>
  );
};

export default TopBar;

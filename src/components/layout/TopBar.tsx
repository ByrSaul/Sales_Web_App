import React from 'react';
import { User } from '../../types';
import { Icon } from '../ui';

interface TopBarProps {
  searchPlaceholder?: string;
  user: User;
  onSearch?: (q: string) => void;
  onMenuOpen?: () => void;
  title?: string;
  onBack?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  searchPlaceholder = 'Buscar...',
  user,
  onSearch,
  onMenuOpen,
  title,
  onBack,
}) => (
  <header className="h-12 fixed top-0 left-0 md:left-56 right-0 bg-white border-b border-outline-variant flex items-center px-4 gap-3 z-30 shadow-sm">
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

    <div className="flex items-center gap-2 ml-auto">
      <button className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container">
        <Icon name="notifications" size={18} className="text-on-surface-variant" />
        <span className="absolute top-1 right-1.5 w-1.5 h-1.5 bg-error rounded-full" />
      </button>
      <div className="hidden md:flex items-center gap-2 border-l border-outline-variant pl-3">
        <div className="text-right">
          <p className="text-xs font-semibold text-on-surface leading-none">{user.name}</p>
          <p className="text-[10px] text-on-surface-variant mt-0.5">{user.role}</p>
        </div>
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
          <span className="text-white text-xs font-bold">{user.name.charAt(0)}</span>
        </div>
      </div>
    </div>
  </header>
);

export default TopBar;

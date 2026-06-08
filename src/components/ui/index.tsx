import React from 'react';

// ─── Icon ──────────────────────────────────────────────────────────────────────
interface IconProps {
  name: string;
  size?: number;
  fill?: boolean;
  className?: string;
}
export const Icon: React.FC<IconProps> = ({ name, size = 20, fill = false, className = '' }) => (
  <span
    className={`material-symbols-outlined select-none ${className}`}
    style={{
      fontSize: size,
      fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
      verticalAlign: 'middle',
      lineHeight: 1,
    }}
  >
    {name}
  </span>
);

// ─── Badge ─────────────────────────────────────────────────────────────────────
type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'blocked';
interface BadgeProps { label: string; variant?: BadgeVariant; dot?: boolean; className?: string; }
const BADGE_STYLES: Record<BadgeVariant, string> = {
  success:  'bg-primary/10 text-primary border border-primary/20',
  warning:  'bg-amber-50 text-amber-700 border border-amber-200',
  danger:   'bg-red-500 text-white',
  neutral:  'bg-surface-container text-on-surface-variant border border-outline-variant',
  info:     'bg-blue-50 text-blue-700 border border-blue-200',
  blocked:  'bg-red-50 text-red-600 border border-red-200',
};
export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral', dot, className = '' }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${BADGE_STYLES[variant]} ${className}`}>
    {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
    {label}
  </span>
);

// ─── Button ────────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'danger';
type ButtonSize    = 'sm' | 'md' | 'lg';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant; size?: ButtonSize; icon?: string;
  iconPosition?: 'left' | 'right'; loading?: boolean; fullWidth?: boolean;
}
const BTN_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary/90',
  ghost:   'text-primary hover:bg-primary/8',
  outline: 'border border-outline-variant text-on-surface hover:bg-surface-container',
  danger:  'bg-error text-white hover:bg-error/90',
};
const BTN_SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1',
  md: 'px-4 py-2 text-sm gap-1.5',
  lg: 'px-5 py-3 text-sm gap-2',
};
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary', size = 'md', icon, iconPosition = 'left',
  loading, fullWidth, children, className = '', disabled, ...props
}) => (
  <button
    disabled={disabled || loading}
    className={`inline-flex items-center justify-center font-medium rounded-lg transition-all active:scale-95 select-none disabled:opacity-50 disabled:cursor-not-allowed ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    {...props}
  >
    {loading && <Icon name="progress_activity" size={14} className="animate-spin" />}
    {!loading && icon && iconPosition === 'left' && <Icon name={icon} size={15} />}
    {children}
    {!loading && icon && iconPosition === 'right' && <Icon name={icon} size={15} />}
  </button>
);

// ─── FAB ───────────────────────────────────────────────────────────────────────
interface FABProps { icon?: string; label?: string; onClick?: () => void; }
export const FAB: React.FC<FABProps> = ({ icon = 'add', label, onClick }) => (
  <button
    onClick={onClick}
    className="fixed bottom-6 right-6 w-12 h-12 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40 group"
  >
    <Icon name={icon} size={22} />
    {label && (
      <span className="absolute right-full mr-2 bg-inverse-surface text-inverse-on-surface px-2 py-1 rounded text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {label}
      </span>
    )}
  </button>
);

// ─── Card ──────────────────────────────────────────────────────────────────────
interface CardProps { children: React.ReactNode; className?: string; onClick?: () => void; hover?: boolean; }
export const Card: React.FC<CardProps> = ({ children, className = '', onClick, hover }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-xl border border-outline-variant/60 shadow-sm ${hover ? 'cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5' : ''} ${onClick ? 'cursor-pointer' : ''} ${className}`}
  >
    {children}
  </div>
);

// ─── Input ─────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; icon?: string; rightIcon?: string; onRightIconClick?: () => void; }
export const Input: React.FC<InputProps> = ({ label, icon, rightIcon, onRightIconClick, className = '', ...props }) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-xs text-on-surface-variant font-medium">{label}</label>}
    <div className="relative flex items-center">
      {icon && <span className="absolute left-2.5 material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>{icon}</span>}
      <input
        className={`w-full py-2 px-3 ${icon ? 'pl-8' : ''} ${rightIcon ? 'pr-8' : ''} rounded-lg border border-outline-variant bg-white text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all ${className}`}
        {...props}
      />
      {rightIcon && (
        <button onClick={onRightIconClick} className="absolute right-2.5 text-primary">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{rightIcon}</span>
        </button>
      )}
    </div>
  </div>
);

// ─── Select ────────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> { label?: string; options: { value: string; label: string }[]; }
export const Select: React.FC<SelectProps> = ({ label, options, className = '', ...props }) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-xs text-on-surface-variant font-medium">{label}</label>}
    <select
      className={`w-full py-2 px-3 rounded-lg border border-outline-variant bg-white text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all appearance-none ${className}`}
      {...props}
    >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

// ─── Toggle ────────────────────────────────────────────────────────────────────
interface ToggleProps { checked: boolean; onChange: (v: boolean) => void; label?: string; }
export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label }) => (
  <div className="flex items-center gap-2">
    {label && <span className="text-xs text-on-surface-variant">{label}</span>}
    <button
      onClick={() => onChange(!checked)}
      className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${checked ? 'bg-primary' : 'bg-outline-variant'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  </div>
);

// ─── BottomSheet ───────────────────────────────────────────────────────────────
interface BottomSheetProps { open: boolean; onClose: () => void; title: string; children: React.ReactNode; }
export const BottomSheet: React.FC<BottomSheetProps> = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full md:max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-outline-variant/40">
          <div className="w-10 h-1 bg-outline-variant rounded-full absolute top-2 left-1/2 -translate-x-1/2 md:hidden" />
          <h2 className="text-base font-bold text-on-surface">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">{children}</div>
      </div>
    </div>
  );
};

// ─── MobileHeader ──────────────────────────────────────────────────────────────
interface MobileHeaderProps { title: string; onBack?: () => void; rightAction?: React.ReactNode; }
export const MobileHeader: React.FC<MobileHeaderProps> = ({ title, onBack, rightAction }) => (
  <div className="md:hidden bg-primary text-white flex items-center gap-3 px-4 py-3 sticky top-0 z-30">
    {onBack && (
      <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20">
        <Icon name="arrow_back" size={18} className="text-white" />
      </button>
    )}
    <h1 className="text-sm font-semibold flex-1">{title}</h1>
    {rightAction}
  </div>
);

// ─── InfoRow ───────────────────────────────────────────────────────────────────
interface InfoRowProps { label: string; value: React.ReactNode; icon?: string; className?: string; }
export const InfoRow: React.FC<InfoRowProps> = ({ label, value, icon, className = '' }) => (
  <div className={`flex items-center gap-2 py-2 border-b border-outline-variant/30 last:border-0 ${className}`}>
    {icon && <Icon name={icon} size={15} className="text-on-surface-variant flex-shrink-0" />}
    <span className="text-xs text-on-surface-variant flex-shrink-0 w-28">{label}</span>
    <span className="text-xs font-semibold text-on-surface flex-1 text-right">{value}</span>
  </div>
);

// ─── SectionTitle ──────────────────────────────────────────────────────────────
interface SectionTitleProps { children: React.ReactNode; action?: React.ReactNode; }
export const SectionTitle: React.FC<SectionTitleProps> = ({ children, action }) => (
  <div className="flex items-center justify-between mb-2">
    <h2 className="text-sm font-bold text-on-surface">{children}</h2>
    {action}
  </div>
);

// ─── EmptyState ────────────────────────────────────────────────────────────────
interface EmptyStateProps { icon?: string; title: string; subtitle?: string; }
export const EmptyState: React.FC<EmptyStateProps> = ({ icon = 'inbox', title, subtitle }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <Icon name={icon} size={40} className="text-outline-variant mb-3" />
    <p className="text-sm font-semibold text-on-surface-variant">{title}</p>
    {subtitle && <p className="text-xs text-on-surface-variant/70 mt-1 max-w-xs">{subtitle}</p>}
  </div>
);

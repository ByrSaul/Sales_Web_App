import { Card, Icon } from '../../../components/ui';

type Props = {
  label: string;
  icon: string;
  value?: number;
  loading: boolean;
  error: boolean;
  accent?: 'primary' | 'secondary';
};

/** Tarjeta de indicador que representa valor, tendencia y estado de consulta. */
export const DashboardMetricCard = ({
  label,
  icon,
  value,
  loading,
  error,
  accent = 'primary',
}: Props) => {
  const text = accent === 'secondary' ? 'text-secondary' : 'text-primary';
  const background = accent === 'secondary' ? 'bg-secondary/10' : 'bg-primary/10';
  return (
    <Card className="min-h-36 p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          {label}
        </p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${background}`}>
          <Icon name={icon} size={18} className={text} />
        </div>
      </div>
      {loading ? (
        <div className="mt-3 h-9 w-20 animate-pulse rounded bg-surface-container" />
      ) : error || value === undefined ? (
        <p className="mt-3 text-sm text-on-surface-variant">No disponible</p>
      ) : (
        <p className={`mt-2 text-4xl font-black leading-none ${text}`}>{value}</p>
      )}
    </Card>
  );
};

import { Card, Icon } from '../../../components/ui';

type Props = {
  value?: number;
  loading: boolean;
  error: boolean;
  onOpen: () => void;
};

/** Tarjeta destacada para el indicador prioritario del Dashboard. */
export const DashboardHighlightCard = ({ value, loading, error, onOpen }: Props) => (
  <Card className="overflow-hidden">
    <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
      <Icon name="groups" size={56} className="text-primary/20" />
      <span className="absolute left-2 top-2 rounded bg-secondary px-2 py-0.5 text-xs font-bold text-white">
        CLIENTES ASIGNADOS
      </span>
    </div>
    <div className="p-4">
      {loading ? (
        <div className="h-7 w-20 animate-pulse rounded bg-surface-container" />
      ) : error || value === undefined ? (
        <p className="text-sm text-on-surface-variant">No disponible</p>
      ) : (
        <p className="text-3xl font-black text-primary">{value}</p>
      )}
      <p className="mt-1 text-sm text-on-surface-variant">
        Clientes disponibles para el vendedor y empresa actuales.
      </p>
      <button
        type="button"
        className="mt-3 w-full rounded-lg border border-outline-variant py-2 text-sm font-medium transition-colors hover:bg-surface-container"
        onClick={onOpen}
      >
        Ver mis clientes
      </button>
    </div>
  </Card>
);
